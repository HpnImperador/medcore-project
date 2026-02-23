/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const { hashSync } = require('bcryptjs');
const { writeFileSync } = require('fs');
const { join } = require('path');

const prisma = new PrismaClient();

const seedData = {
  organization: {
    name: 'MedCore Organização Demo',
    tax_id: '99.999.999/0001-99',
  },
  branch: {
    name: 'Unidade Central',
    address: 'Av. Saúde, 1000 - Centro',
  },
  doctor: {
    name: 'Médico Teste',
    email: 'medico@medcore.com',
    password: '123456',
    role: 'DOCTOR',
  },
  admin: {
    name: 'Admin MedCore',
    email: 'admin@medcore.com',
    password: '123456',
    role: 'ADMIN',
  },
  patient: {
    name: 'Paciente Teste',
    email: 'paciente@medcore.com',
    phone: '+55 11 99999-0000',
    document: '111.111.111-11',
  },
};

async function upsertOrganization() {
  return prisma.organizations.upsert({
    where: { tax_id: seedData.organization.tax_id },
    create: {
      name: seedData.organization.name,
      tax_id: seedData.organization.tax_id,
    },
    update: {
      name: seedData.organization.name,
    },
  });
}

async function upsertBranch(organizationId) {
  const existing = await prisma.branches.findFirst({
    where: {
      organization_id: organizationId,
      name: seedData.branch.name,
    },
  });

  if (existing) {
    return prisma.branches.update({
      where: { id: existing.id },
      data: {
        address: seedData.branch.address,
      },
    });
  }

  return prisma.branches.create({
    data: {
      organization_id: organizationId,
      name: seedData.branch.name,
      address: seedData.branch.address,
    },
  });
}

async function upsertDoctor(organizationId) {
  const passwordHash = hashSync(seedData.doctor.password, 10);

  return prisma.users.upsert({
    where: { email: seedData.doctor.email },
    create: {
      organization_id: organizationId,
      name: seedData.doctor.name,
      email: seedData.doctor.email,
      password_hash: passwordHash,
      role: seedData.doctor.role,
    },
    update: {
      organization_id: organizationId,
      name: seedData.doctor.name,
      password_hash: passwordHash,
      role: seedData.doctor.role,
    },
  });
}

async function upsertAdmin(organizationId) {
  const passwordHash = hashSync(seedData.admin.password, 10);

  return prisma.users.upsert({
    where: { email: seedData.admin.email },
    create: {
      organization_id: organizationId,
      name: seedData.admin.name,
      email: seedData.admin.email,
      password_hash: passwordHash,
      role: seedData.admin.role,
    },
    update: {
      organization_id: organizationId,
      name: seedData.admin.name,
      password_hash: passwordHash,
      role: seedData.admin.role,
    },
  });
}

async function upsertUserBranch(userId, branchId) {
  return prisma.user_branches.upsert({
    where: {
      user_id_branch_id: {
        user_id: userId,
        branch_id: branchId,
      },
    },
    create: {
      user_id: userId,
      branch_id: branchId,
    },
    update: {},
  });
}

async function upsertPatient(organizationId) {
  const existing = await prisma.patients.findFirst({
    where: {
      organization_id: organizationId,
      document: seedData.patient.document,
    },
  });

  if (existing) {
    return prisma.patients.update({
      where: { id: existing.id },
      data: {
        name: seedData.patient.name,
        email: seedData.patient.email,
        phone: seedData.patient.phone,
      },
    });
  }

  return prisma.patients.create({
    data: {
      organization_id: organizationId,
      name: seedData.patient.name,
      email: seedData.patient.email,
      phone: seedData.patient.phone,
      document: seedData.patient.document,
    },
  });
}

async function main() {
  const organization = await upsertOrganization();
  const branch = await upsertBranch(organization.id);
  const doctor = await upsertDoctor(organization.id);
  const admin = await upsertAdmin(organization.id);
  await upsertUserBranch(doctor.id, branch.id);
  const patient = await upsertPatient(organization.id);

  const envContent = [
    `TEST_EMAIL=${seedData.doctor.email}`,
    `TEST_PASSWORD=${seedData.doctor.password}`,
    `ADMIN_EMAIL=${seedData.admin.email}`,
    `ADMIN_PASSWORD=${seedData.admin.password}`,
    `TEST_BRANCH_ID=${branch.id}`,
    `TEST_PATIENT_ID=${patient.id}`,
    `TEST_DOCTOR_ID=${doctor.id}`,
    `ORGANIZATION_ID=${organization.id}`,
    `BRANCH_ID=${branch.id}`,
    `PATIENT_ID=${patient.id}`,
    `DOCTOR_ID=${doctor.id}`,
  ].join('\n');

  const seedEnvPath = join(__dirname, '..', '.seed.env');
  writeFileSync(seedEnvPath, `${envContent}\n`, { encoding: 'utf8' });

  console.log('Seed idempotente concluído com sucesso.');
  console.log(`ORGANIZATION_ID=${organization.id}`);
  console.log(`BRANCH_ID=${branch.id}`);
  console.log(`DOCTOR_ID=${doctor.id}`);
  console.log(`PATIENT_ID=${patient.id}`);
  console.log(`TEST_EMAIL=${seedData.doctor.email}`);
  console.log(`TEST_PASSWORD=${seedData.doctor.password}`);
  console.log(`ADMIN_ID=${admin.id}`);
  console.log(`ADMIN_EMAIL=${seedData.admin.email}`);
  console.log(`ADMIN_PASSWORD=${seedData.admin.password}`);
  console.log(`SEED_ENV_PATH=${seedEnvPath}`);
}

main()
  .catch((error) => {
    console.error('Erro ao executar seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
