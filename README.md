# MedCore Project

Sistema de gestão médica desenvolvido com NestJS e Prisma.

## 🚀 Atualizações Recentes

### Interceptors (Interceptadores)
Foram adicionados interceptadores globais para monitoramento e padronização:

- **LoggingInterceptor**: Monitora o tempo de execução de cada requisição HTTP e registra o usuário (ou IP) que iniciou a ação, útil para auditoria e performance.
- **TransformInterceptor**: Intercepta todas as respostas de sucesso da API e as envolve em um formato padrão `{ data: ..., meta: ... }`, garantindo consistência no retorno para o frontend.

### Filtros de Exceção (Exception Filters)
- **GlobalExceptionFilter**: Captura exceções não tratadas, erros do Prisma (como violação de chave única ou registro não encontrado) e erros de validação, retornando uma resposta JSON amigável e padronizada com status HTTP correto.

### Documentação (Swagger)
A documentação interativa da API foi configurada.
- Acesse `http://localhost:3000/api` após iniciar o servidor para visualizar e testar os endpoints.

### Validação Customizada
- **@IsFutureDate**: Um decorador de validação personalizado foi criado para garantir que agendamentos não sejam criados no passado. Ele é integrado diretamente aos DTOs e processado pelo `ValidationPipe`.

### Autenticação
- **Endpoint de Login**: Implementado o endpoint `POST /auth/login` que recebe `email` e `password`, valida as credenciais e retorna um token de acesso **JWT (JSON Web Token)**.
- **Documentação Swagger**: O endpoint de login foi documentado com Swagger, permitindo testes e obtenção de tokens diretamente pela interface da API em `http://localhost:3000/api`. Agora é possível usar o botão "Authorize" no Swagger para autenticar as requisições nas rotas protegidas.

### Usuários
- **Perfil do Usuário**: Implementada a rota `GET /users/me` que retorna os dados do usuário autenticado.
- **Proteção de Rotas**: Utilização do `JwtAuthGuard` para proteger endpoints que requerem autenticação.
- **Decorador @CurrentUser**: Criado para extrair facilmente o usuário do payload do token JWT nas requisições.

### Testes E2E (Ponta a Ponta)
- **Teste de Usuário**: Adicionado `test/users.e2e-spec.ts` para validar a rota `/users/me`.
- **Cenários Cobertos**: Validação de acesso negado (401) sem token e acesso permitido (200) com token válido, garantindo que a senha não seja retornada.

### Controle de Acesso (RBAC)
- **Role Enum**: Definido enum `Role` (USER, ADMIN, DOCTOR) para padronizar os tipos de usuários.
- **@Roles Decorator**: Decorador para especificar quais perfis têm acesso a uma rota.
- **RolesGuard**: Guardião que verifica se o usuário autenticado possui a role necessária para acessar o recurso.

## 🧪 Testes

O projeto inclui testes unitários e de integração (e2e).

### Rodando Testes Unitários
Executa os testes isolados de serviços, interceptors, filtros e validadores customizados.
```bash
npm run test
```

### Rodando Testes E2E (Ponta a Ponta)
Executa testes que simulam requisições reais à API, verificando o fluxo completo desde o controller até o banco de dados (ou mock).
```bash
npm run test:e2e
```

---