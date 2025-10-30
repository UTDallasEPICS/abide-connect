import {auth} from "~/../lib/auth"
import prisma from "~/../lib/prisma"
import { Language } from "@prisma/client"

export default defineEventHandler(async (event) => {
    const {name, email, password, phone, languages} = await readBody(event)
    
    const data = await auth.api.signUpEmail({body: {name, email, password}})

    // Create corresponding User record and link to Volunteer
    const createdUser = await prisma.user.create({
        data: {
            name: name as string | undefined,
            contactEmail: email as string,
            phone: phone as string | undefined,
        }
    })

    await prisma.volunteer.update({
        where: { id: data.user.id },
        data: {
            phone: phone as string,
            user: { connect: { id: createdUser.id } },
            Languages: {
                create: (languages as Language[] | undefined)?.map((language: Language) => ({
                    language,
                    user: { connect: { id: createdUser.id } },
                })) ?? [],
            },
        }
    })

    return { success: true }
})
