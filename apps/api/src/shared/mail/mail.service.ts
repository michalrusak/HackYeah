import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

/**
 * Powiadomienia e-mail są dodatkiem do powiadomień w aplikacji: wysyłka nie
 * blokuje żądania, a jej błąd nigdy nie psuje operacji użytkownika. Bez
 * `SMTP_URL` nic nie wychodzi; do logu trafia sam temat, bez adresu i treści.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transport?: Transporter;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  notifyRops(subject: string, text: string): void {
    this.send(this.config.get<string>('ROPS_NOTIFY_EMAIL'), subject, text);
  }

  send(to: string | null | undefined, subject: string, text: string): void {
    const url = this.config.get<string>('SMTP_URL');
    if (!to || !url) {
      this.logger.log(`E-mail pominięty (brak konfiguracji): ${subject}`);
      return;
    }
    this.transport ??= createTransport(url);
    this.transport
      .sendMail({
        from: this.config.get<string>('MAIL_FROM') ?? 'no-reply@localhost',
        to,
        subject,
        text,
      })
      .catch(() => this.logger.warn(`Nie wysłano e-maila: ${subject}`));
  }

  /** Adres strony fiszki — autor otwiera ją na urządzeniu z zapisanym kodem edycji. */
  ideaUrl(ideaId: string): string {
    const origin =
      this.config.get<string>('WEB_ORIGIN') ??
      `http://localhost:${this.config.get<string>('WEB_PORT') ?? '4200'}`;
    return `${origin}/pomysly/${ideaId}`;
  }
}
