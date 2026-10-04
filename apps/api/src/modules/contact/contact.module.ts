import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { MailService } from '../../shared/mail/mail.service.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  ContactAdminController,
  ContactController,
  ContactExpertController,
} from './contact.controller.js';
import { ContactRepository } from './contact.repository.js';
import { ContactService } from './contact.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  controllers: [
    ContactController,
    ContactAdminController,
    ContactExpertController,
  ],
  providers: [ContactService, ContactRepository, MailService],
})
export class ContactModule {}
