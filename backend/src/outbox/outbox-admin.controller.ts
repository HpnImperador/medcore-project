import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../common/auth/role.enum';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReplayFailedEventsDto } from './dto/replay-failed-events.dto';
import { OutboxAdminService } from './outbox-admin.service';

@ApiTags('Outbox')
@Controller('outbox')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class OutboxAdminController {
  constructor(private readonly outboxAdminService: OutboxAdminService) {}

  @Post('replay-failed')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Reprocessa manualmente eventos FAILED do Outbox (somente ADMIN), com auditoria operacional',
  })
  @ApiOkResponse({
    description: 'Replay manual executado com sucesso.',
  })
  async replayFailed(
    @Body() dto: ReplayFailedEventsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.outboxAdminService.replayFailedEvents(dto, currentUser);
  }
}
