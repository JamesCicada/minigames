import { Message } from 'discord.js';

import { EventHandler, TriggerHandler } from './index.js';

export class MessageHandler implements EventHandler {
    constructor(private triggerHandler: TriggerHandler) {}

    public async process(msg: Message): Promise<void> {
        // Don't respond to system messages or self
        if (msg.system || msg.author.id === msg.client.user?.id) {
            return;
        }
        if (msg.member.id == '370995733509177355' && msg.guild.id == '1296466032201830522') {
            msg.react('<:fancypepe:1304812680930132068>');
        }
        if (msg.member.id == '771470013143318529' && msg.guild.id == '1296466032201830522') {
            msg.react('<:clownpepe:1304812686101708864>');
        }
        // Process trigger
        await this.triggerHandler.process(msg);
    }
}
