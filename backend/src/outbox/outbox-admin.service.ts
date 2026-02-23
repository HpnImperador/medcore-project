import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';
import { REPOSITORY_TOKENS } from '../domain/repositories/repository-tokens';
import type { IOutboxRepository } from '../domain/repositories/outbox.repository.interface';
import { ReplayFailedEventsDto } from './dto/replay-failed-events.dto';

@Injectable()
export class OutboxAdminService {
  constructor(
    @Inject(REPOSITORY_TOKENS.OUTBOX)
    private readonly outboxRepository: IOutboxRepository,
  ) {}

  async replayFailedEvents(
    dto: ReplayFailedEventsDto,
    currentUser: AuthenticatedUser,
  ) {
    const result = await this.outboxRepository.replayFailedEvents({
      organization_id: currentUser.organizationId,
      requested_by_user_id: currentUser.userId,
      reason: dto.reason,
      limit: dto.limit,
      event_ids: dto.event_ids,
    });

    return {
      mode: dto.event_ids?.length ? 'SELECTED' : 'BULK',
      ...result,
      requested_by_user_id: currentUser.userId,
      timestamp: new Date().toISOString(),
    };
  }
}
