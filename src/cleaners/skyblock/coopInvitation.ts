import typedHypixelApi from 'typed-hypixel-api'
import { CleanPlayer } from '../player'
import * as cached from '../../hypixelCached.js'


export interface CoopInvitation {
	invitedTimestamp: number
	invitedBy: CleanPlayer | null
	accepted: boolean
	acceptedTimestamp: number | null
}

export async function cleanCoopInvitation(data: typedHypixelApi.SkyBlockProfileMember, uuid: string): Promise<CoopInvitation | null> {
	if (!data.coop_invitation)
		return null

	let invitedTimestamp = data.coop_invitation.timestamp
	let acceptedTimestamp = data.coop_invitation.confirmed_timestamp ?? null

	// the accepted timestamp should always be greater, otherwise swap
	if (acceptedTimestamp !== null && invitedTimestamp > acceptedTimestamp) {
		let temp = invitedTimestamp
		invitedTimestamp = acceptedTimestamp
		acceptedTimestamp = temp
	}

	return {
		invitedTimestamp,
		invitedBy: await cached.fetchBasicPlayer(data.coop_invitation.invited_by, false),
		accepted: data.coop_invitation.confirmed,
		acceptedTimestamp
	}
}