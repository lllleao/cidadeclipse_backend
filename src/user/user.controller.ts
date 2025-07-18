import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UseGuards
} from '@nestjs/common'
import { CreateAddressDto, LoginDTO, SignupDTO } from './user.dto'
import { UserService } from './user.service'
import { CrsfGuard } from 'src/auth/auth.crsf.guard'
import { Request, Response } from 'express'
import { JwtGuard } from 'src/auth/auth.jwt.guard'
import cpfValidator from './utils/cpfValidator'
import * as jwt from 'jsonwebtoken'
import { checkTokenFront } from './utils/user.utils'

@Controller('user')
export class UserController {
    constructor(private userService: UserService) {}

    @UseGuards(CrsfGuard)
    @Post('signup')
    async signup(@Req() req: Request, @Body() body: SignupDTO) {
        const { email, name, password } = body
        const token = req.cookies.token as string

        if (token) {
            throw new BadRequestException('Usuário já logado')
        }

        return await this.userService.createUser(password, email, name)
    }

    @UseGuards(CrsfGuard)
    @Post('login')
    async login(
        @Body() body: LoginDTO,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const { email, password } = body
        const tokenFrontend = req.cookies.token as string

        if (checkTokenFront(tokenFrontend)) {
            try {
                jwt.verify(tokenFrontend, process.env.JWT_SECRET!)
                return res.status(400).json({ message: 'Usuário já logado' })
            } catch (err) {
                if (
                    err instanceof jwt.JsonWebTokenError &&
                    !(err.message === 'jwt expired')
                ) {
                    console.log('Token mal formado', err.message)
                    throw new BadRequestException({
                        message: 'Token mal formado',
                        error: 'Token mal formado',
                        statusCode: 400
                    })
                } else if (
                    err instanceof jwt.TokenExpiredError &&
                    err.message === 'jwt expired'
                ) {
                    console.log('Token expirado:', err.message)
                } else {
                    console.log('Erro desconhecido:', err)
                }
            }
        }

        const { token, refreshToken } = await this.userService.login(
            email,
            password
        )

        res.cookie('token', token, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax', // none
            // secure: true, TROCAR PARA ALKGO SEGURO DEPOIS
            maxAge: 3600000
        })

        res.cookie('refresh', refreshToken, {
            path: '/auth/refresh',
            httpOnly: true,
            sameSite: 'lax', // none
            // secure: true, TROCAR PARA ALKGO SEGURO DEPOIS
            maxAge: 604800000
        })

        return res.status(200).json({ success: true })
    }

    @UseGuards(CrsfGuard, JwtGuard)
    @Get('profile')
    async getProfileData(@Req() req: Request) {
        return await this.userService.profileData(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            req['user'].userId as number
        )
    }

    @UseGuards(CrsfGuard)
    @Post('logout')
    logout(@Res() res: Response) {
        res.clearCookie('token')
        res.clearCookie('refresh')

        res.status(200).json({ msg: 'Logout realizado' })
    }

    @UseGuards(CrsfGuard, JwtGuard)
    @Post('address')
    async postCreateAddress(
        @Req() req: Request,
        @Body() body: CreateAddressDto
    ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const userId = req['user'].userId as number
        const {
            cpf,
            isDefault,
            neighborhood,
            number,
            street,
            zipCode,
            complement,
            name
        } = body.data

        if (!cpfValidator(cpf)) {
            throw new BadRequestException('CPF inválido')
        }

        await this.userService.createAddress(
            { userId },
            {
                data: {
                    cpf,
                    isDefault,
                    neighborhood,
                    number,
                    street,
                    zipCode,
                    complement,
                    name
                }
            }
        )

        return { success: true }
    }

    @UseGuards(CrsfGuard, JwtGuard)
    @Get('get-address')
    async getAddress(@Req() req: Request) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const userId = req['user'].userId as number
        return await this.userService.addressUser(userId)
    }
}
