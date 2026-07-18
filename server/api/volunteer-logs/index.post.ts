import prisma from '#server/utils/prisma'
import { auth } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
    try {
        const session = await auth.api.getSession({ headers: event.headers })
        const body = await readBody(event)
        const { eventId, eventName, date, hours, comment } = body

        if (!date || !hours) {
            throw createError({
                statusCode: 400,
                statusMessage: 'date and hours are required',
            })
        }

        const volunteer = await prisma.volunteer.findUnique({
            where: { userId: session?.user.id }
        })

        if (!volunteer) {
            throw createError({
                statusCode: 403, 
                statusMessage: 'User is not a registered volunteer',
            })
        }

        const log = await prisma.volunteer_Hour_Log.create({
            data: {
                volunteerId: volunteer.id,
                eventId: eventId,
                eventName: eventName,
                date: new Date(date),
                hours: hours,
                approvalStatus: 'PENDING'
            }
        })

        return {
            success: true,
            log: log,
        }
    }
    catch(error: any) {
        if (error.statusCode) throw error
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to get session',
            cause: error,
        })
    } 

})