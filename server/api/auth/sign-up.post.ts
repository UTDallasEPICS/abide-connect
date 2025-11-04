import {auth} from "~/../lib/auth"
import prisma from "~/../lib/prisma"
import { Language } from "@prisma/client"

export default defineEventHandler(async (event) => {
    const {name, email, password, phone, languages} = await readBody(event)
    
    const data = await auth.api.signUpEmail({body: {name, email, password}})
    console.log(data)
    await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
            data: {
                name: name as string | undefined,
                contactEmail: email as string,
                phone: phone as string | undefined,
            },
        })

        // await tx.volunteer.update({
        //     where: { id: data.user.id },
        //     data: {
        //         phone: phone as string,
        //         userId: createdUser.id,
        //         languages: {
        //             create: languageArray.map((language: Language) => ({
        //                     language: language,
        //                 })),
        //             },
        //         },
        //     })
    });
    return { success: true }
})
