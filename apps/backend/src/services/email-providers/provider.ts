export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Always sent — HTML-only mail is scored as spam by most filters. */
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: OutgoingEmail): Promise<void>;
}
