import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';
import { ContactRepository } from './contact.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ContactController],
  providers: [ContactService, ContactRepository],
})
export class ContactModule {}
