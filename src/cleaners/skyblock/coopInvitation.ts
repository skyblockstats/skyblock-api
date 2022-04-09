import typedHypixelApi from 'typed-hypixel-api'
import { CleanPlayer } from '../player'
import * as cached from '../../hypixelCached.js'


export interface CoopInvitation {
	invitedTimestamp: number
	invitedBy: CleanPlayer | null
	accepted: boolean
	acceptedTimestamp: number | null
}

export async function cleanCoopInvitation(data: typedHypixelApi.SkyBlockProfileMember): Promise<CoopInvitation | null> {
	if (!data.coop_invitation)
		return null
	return {
		invitedTimestamp: data.coop_invitation.timestamp,
		invitedBy: await cached.fetchBasicPlayer(data.coop_invitation.invited_by, false),
		accepted: data.coop_invitation.confirmed,
		acceptedTimestamp: data.coop_invitation.confirmed_timestamp ?? null
	}
}