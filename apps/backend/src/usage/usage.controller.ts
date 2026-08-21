import {Controller, Get, UseGuards} from '@nestjs/common'
import {AuthGuard} from '@nestjs/passport'
import {CurrentUser} from '../common/tenant/current-user.decorator'
import {AuthenticatedUser} from '../common/tenant/tenant.types'
import {PrismaService} from '../common/database/prisma.service'
@UseGuards(AuthGuard('jwt'))
@Controller('usage')
export class UsageController {
	constructor(private p: PrismaService) {}
	@Get() summary(@CurrentUser() u: AuthenticatedUser) {
		return this.p.withTenant(u.tenantId, async (tx) => {
			const a = await tx.query.aggregate({_sum: {tokensUsed: true, estimatedCostUsd: true}, _count: true})
			return {queries: a._count, tokens: a._sum.tokensUsed ?? 0, cost: a._sum.estimatedCostUsd ?? 0}
		})
	}
}
