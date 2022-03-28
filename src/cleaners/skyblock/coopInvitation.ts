import typedHypixelApi from 'typed-hypixel-api'

export interface CoopInvitation {
	invitedTimestamp: number
	invitedByUuid: string
	accepted: boolean
	acceptedTimestamp: number | null
}

export function cleanCoopInvitation(data: typedHypixelApi.SkyBlockProfileMember): null | CoopInvitation {
	if (!data.coop_invitation)
		return null
	return {
		invitedTimestamp: data.coop_invitation.timestamp,
		invitedByUuid: data.coop_invitation.invited_by,
		accepted: data.coop_invitation.confirmed,
		acceptedTimestamp: data.coop_invitation.confirmed_timestamp ?? null
	}
}