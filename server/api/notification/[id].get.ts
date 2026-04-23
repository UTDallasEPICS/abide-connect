import prisma from "~~/server/utils/prisma";

export default eventHandler( async (event) => {
    try {
        const userId = getRouterParam(event, "id")

        if (!userId) {
            throw createError({
                statusCode: 400,
                statusMessage: "Notification ID and User ID are required"
            })
        }
        const notifications = await prisma.notification.findMany({
            where: {
                users: {
                    some: {
                        userId
                    }
                }
            },
            include: {
                users: {
                    where: {
                        userId
                    },
                    select: {
                        isRead: true,
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        })

        // format the response
        const formattedNotifications = notifications.map(notification => ({
            id: notification.id,
            title: notification.title,
            content: notification.content,
            createdAt: notification.createdAt,
            isRead: notification.users[0]?.isRead || false,
        }))
        return {
            success: true,
            notifications: formattedNotifications
        }
    } catch (error) {
        console.error("Error fetching notifications:", error)
        
    }

})

