import {auth} from "~/../lib/auth"
import prisma from "~/../lib/prisma"
import { Language } from "@prisma/client"

export default defineEventHandler(async (event) => {
    const {name, email, password, phone, languages} = await readBody(event)
    
    const data = await auth.api.signUpEmail({body: {name, email, password}})

    await prisma.volunteer.update({
        where: {id: data.user.id},
        data: {
            phone: phone as string,
            Languages: {
                create: languages.map((language: Language) => ({
                    language: language,
                })),
            },
        }
    })

    return { success: true }
})
