import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { REPOSITORY_TOKENS } from '../src/domain/repositories/repository-tokens';
import { N8nWebhookService } from '../src/integrations/n8n/n8n-webhook.service';
import { PrismaService } from '../src/prisma/prisma.service';

interface LoginData {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    organization_id: string;
    branch_ids: string[];
  };
}

interface AppointmentData {
  id: string;
  status: string;
}

function dataOf<T>(response: Response): T {
  const body = response.body as { data: T };
  return body.data;
}

describe('MedCore API (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let mockN8n: { notifyAppointmentCompleted: jest.Mock };

  const organizationId = 'f8f79fe1-c4cf-4d98-b6e5-e5dd574029f4';
  const branchId = 'f10f3f31-93e0-4f74-84cf-3d0864f0529e';
  const patientId = '8bcb577b-cbb8-4a19-8dca-ef8a8eeead29';
  const doctorId = '6ef3ab38-a6b8-4cb7-9a5a-182e6ffdc5c4';

  const mockUsersRepository = {
    findByEmail: jest.fn((email: string) => {
      if (email !== 'medico@medcore.com') {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        id: doctorId,
        organization_id: organizationId,
        name: 'Medico Teste',
        email: 'medico@medcore.com',
        password_hash:
          '$2b$10$rlf4JX3lLyqbUoPM6cPWlusrTsL1hsrsaNoAOvmNLTne5eVBxx9yC',
        role: 'DOCTOR',
        user_branches: [{ branch_id: branchId }],
      });
    }),
    findProfileByIdAndOrganization: jest.fn((userId: string, orgId: string) => {
      if (userId !== doctorId || orgId !== organizationId) {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        id: doctorId,
        organization_id: organizationId,
        name: 'Medico Teste',
        email: 'medico@medcore.com',
        role: 'DOCTOR',
        created_at: new Date('2026-02-01T00:00:00.000Z'),
      });
    }),
  };

  const appointmentsStore: Array<{
    id: string;
    organization_id: string;
    branch_id: string;
    patient_id: string;
    doctor_id: string;
    scheduled_at: Date;
    status: string;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
  }> = [];

  const refreshTokensStore: Array<{
    id: string;
    token_hash: string;
    user_id: string;
    organization_id: string;
    expires_at: Date;
    revoked_at: Date | null;
    last_used_at: Date | null;
    replaced_by_token_id: string | null;
    created_at: Date;
  }> = [];

  const mockPatientsRepository = {
    create: jest.fn(),
    findAllByOrganization: jest.fn(),
    findByIdAndOrganization: jest.fn((id: string, orgId: string) => {
      if (id === patientId && orgId === organizationId) {
        return Promise.resolve({
          id: patientId,
          organization_id: organizationId,
          name: 'Paciente Teste',
          email: null,
          phone: null,
          document: null,
          birth_date: null,
          created_at: new Date(),
        });
      }
      return Promise.resolve(null);
    }),
  };

  const mockAppointmentsRepository = {
    create: jest.fn(
      (input: {
        organization_id: string;
        branch_id: string;
        patient_id: string;
        doctor_id: string;
        scheduled_at: Date;
        status: string;
        notes?: string | null;
      }) => {
        const appointment = {
          id: `appt-${appointmentsStore.length + 1}`,
          organization_id: input.organization_id,
          branch_id: input.branch_id,
          patient_id: input.patient_id,
          doctor_id: input.doctor_id,
          scheduled_at: input.scheduled_at,
          status: input.status,
          notes: input.notes ?? null,
          created_at: new Date(),
          updated_at: new Date(),
        };
        appointmentsStore.push(appointment);
        return Promise.resolve(appointment);
      },
    ),
    completeByIdInOrganizationAndBranches: jest.fn(
      (appointmentId: string, orgId: string, branches: string[]) => {
        const found = appointmentsStore.find(
          (item) =>
            item.id === appointmentId &&
            item.organization_id === orgId &&
            branches.includes(item.branch_id),
        );

        if (!found) {
          return Promise.resolve(null);
        }

        found.status = 'COMPLETED';
        found.updated_at = new Date();
        return Promise.resolve(found);
      },
    ),
    findDoctorByIdAndOrganization: jest.fn((id: string, orgId: string) => {
      if (id === doctorId && orgId === organizationId) {
        return Promise.resolve({
          id: doctorId,
          organization_id: organizationId,
          role: 'DOCTOR',
        });
      }
      return Promise.resolve(null);
    }),
    isDoctorInBranch: jest.fn((id: string, bId: string) =>
      Promise.resolve(id === doctorId && bId === branchId),
    ),
    isBranchFromOrganization: jest.fn((bId: string, orgId: string) =>
      Promise.resolve(bId === branchId && orgId === organizationId),
    ),
    findAllByOrganizationAndBranches: jest.fn(
      (orgId: string, branches: string[]) =>
        Promise.resolve(
          appointmentsStore.filter(
            (item) =>
              item.organization_id === orgId &&
              branches.includes(item.branch_id),
          ),
        ),
    ),
  };

  const mockRefreshTokensRepository = {
    create: jest.fn(
      (input: {
        user_id: string;
        organization_id: string;
        token_hash: string;
        expires_at: Date;
      }) => {
        const entity = {
          id: `rt-${refreshTokensStore.length + 1}`,
          user_id: input.user_id,
          organization_id: input.organization_id,
          token_hash: input.token_hash,
          expires_at: input.expires_at,
          created_at: new Date(),
          revoked_at: null,
          last_used_at: null,
          replaced_by_token_id: null,
        };
        refreshTokensStore.push(entity);
        return Promise.resolve(entity);
      },
    ),
    findActiveByHash: jest.fn((tokenHash: string) => {
      const found = refreshTokensStore.find(
        (item) =>
          item.token_hash === tokenHash &&
          item.revoked_at === null &&
          item.expires_at > new Date(),
      );
      return Promise.resolve(found ?? null);
    }),
    revokeById: jest.fn((tokenId: string, replacedByTokenId?: string) => {
      const found = refreshTokensStore.find((item) => item.id === tokenId);
      if (found) {
        found.revoked_at = new Date();
        found.last_used_at = new Date();
        found.replaced_by_token_id = replacedByTokenId ?? null;
      }
      return Promise.resolve();
    }),
    touchUsage: jest.fn((tokenId: string) => {
      const found = refreshTokensStore.find((item) => item.id === tokenId);
      if (found) {
        found.last_used_at = new Date();
      }
      return Promise.resolve();
    }),
    revokeByHash: jest.fn((tokenHash: string) => {
      refreshTokensStore.forEach((item) => {
        if (item.token_hash === tokenHash && item.revoked_at === null) {
          item.revoked_at = new Date();
          item.last_used_at = new Date();
        }
      });
      return Promise.resolve();
    }),
  };

  beforeAll(async () => {
    mockN8n = {
      notifyAppointmentCompleted: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: () => Promise.resolve(undefined),
        onModuleDestroy: () => Promise.resolve(undefined),
      })
      .overrideProvider(REPOSITORY_TOKENS.USERS)
      .useValue(mockUsersRepository)
      .overrideProvider(REPOSITORY_TOKENS.PATIENTS)
      .useValue(mockPatientsRepository)
      .overrideProvider(REPOSITORY_TOKENS.APPOINTMENTS)
      .useValue(mockAppointmentsRepository)
      .overrideProvider(REPOSITORY_TOKENS.REFRESH_TOKENS)
      .useValue(mockRefreshTokensRepository)
      .overrideProvider(N8nWebhookService)
      .useValue(mockN8n)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.useGlobalInterceptors(
      new LoggingInterceptor(),
      new TransformInterceptor(),
    );

    const httpAdapter = app.get(HttpAdapterHost);
    app.useGlobalFilters(new GlobalExceptionFilter(httpAdapter));

    await app.init();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deve autenticar com sucesso em /auth/login', async () => {
    const response = await request(baseUrl)
      .post('/auth/login')
      .send({
        email: 'medico@medcore.com',
        password: '123456',
      })
      .expect(201);

    const login = dataOf<LoginData>(response);
    expect(login.access_token).toBeDefined();
    expect(login.refresh_token).toBeDefined();
    expect(login.user.email).toBe('medico@medcore.com');
    expect(login.user.role).toBe('DOCTOR');
  });

  it('deve rotacionar refresh token em /auth/refresh', async () => {
    const loginResponse = await request(baseUrl)
      .post('/auth/login')
      .send({
        email: 'medico@medcore.com',
        password: '123456',
      })
      .expect(201);

    const login = dataOf<LoginData>(loginResponse);

    const response = await request(baseUrl)
      .post('/auth/refresh')
      .send({
        refresh_token: login.refresh_token,
      })
      .expect(201);

    const refreshed = dataOf<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>(response);
    expect(refreshed.access_token).toBeDefined();
    expect(refreshed.refresh_token).toBeDefined();
    expect(refreshed.refresh_token).not.toBe(login.refresh_token);
  });

  it('deve revogar refresh token em /auth/logout', async () => {
    const loginResponse = await request(baseUrl)
      .post('/auth/login')
      .send({
        email: 'medico@medcore.com',
        password: '123456',
      })
      .expect(201);

    const login = dataOf<LoginData>(loginResponse);

    const response = await request(baseUrl)
      .post('/auth/logout')
      .send({
        refresh_token: login.refresh_token,
      })
      .expect(201);

    const logout = dataOf<{ success: boolean }>(response);
    expect(logout.success).toBe(true);
  });

  it('deve retornar 401 para login inválido', async () => {
    await request(baseUrl)
      .post('/auth/login')
      .send({
        email: 'medico@medcore.com',
        password: 'senha-incorreta',
      })
      .expect(401);
  });

  it('deve retornar perfil autenticado em /users/me', async () => {
    const loginResponse = await request(baseUrl)
      .post('/auth/login')
      .send({
        email: 'medico@medcore.com',
        password: '123456',
      })
      .expect(201);

    const token = dataOf<LoginData>(loginResponse).access_token;

    const response = await request(baseUrl)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const me = dataOf<{
      email: string;
      organization_id: string;
      branch_ids: string[];
    }>(response);

    expect(me.email).toBe('medico@medcore.com');
    expect(me.organization_id).toBe(organizationId);
    expect(me.branch_ids).toContain(branchId);
  });

  it('deve executar fluxo de agendamento: criar, listar e concluir', async () => {
    const loginResponse = await request(baseUrl)
      .post('/auth/login')
      .send({
        email: 'medico@medcore.com',
        password: '123456',
      })
      .expect(201);

    const token = dataOf<LoginData>(loginResponse).access_token;
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const createResponse = await request(baseUrl)
      .post('/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        branch_id: branchId,
        patient_id: patientId,
        doctor_id: doctorId,
        scheduled_at: scheduledAt,
        notes: 'E2E agendamento',
      })
      .expect(201);

    const created = dataOf<AppointmentData>(createResponse);
    expect(created.id).toBeDefined();

    const listResponse = await request(baseUrl)
      .get('/appointments')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const listed = dataOf<AppointmentData[]>(listResponse);
    expect(Array.isArray(listed)).toBe(true);
    expect(listed.length).toBeGreaterThanOrEqual(1);

    const completeResponse = await request(baseUrl)
      .patch(`/appointments/${created.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const completed = dataOf<AppointmentData>(completeResponse);
    expect(completed.status).toBe('COMPLETED');
    expect(mockN8n.notifyAppointmentCompleted).toHaveBeenCalled();
  });
});
