import {
    AutocompleteInteraction,
    ButtonInteraction,
    Client,
    CommandInteraction,
    Events,
    Guild,
    Interaction,
    Message,
    MessageReaction,
    PartialMessageReaction,
    PartialUser,
    RateLimitData,
    RESTEvents,
    User,
} from 'discord.js';
import { createRequire } from 'node:module';

import {
    ButtonHandler,
    CommandHandler,
    GuildJoinHandler,
    GuildLeaveHandler,
    MessageHandler,
    ReactionHandler,
} from '../events/index.js';
import { JobService, Logger } from '../services/index.js';
import { PartialUtils } from '../utils/index.js';

const require = createRequire(import.meta.url);
let Config = require('../../config/config.json');
let Debug = require('../../config/debug.json');
let Logs = require('../../lang/logs.json');

export class Bot {
    private ready = false;

    constructor(
        private token: string,
        private client: Client,
        private guildJoinHandler: GuildJoinHandler,
        private guildLeaveHandler: GuildLeaveHandler,
        private messageHandler: MessageHandler,
        private commandHandler: CommandHandler,
        private buttonHandler: ButtonHandler,
        private reactionHandler: ReactionHandler,
        private jobService: JobService
    ) {}

    public async start(): Promise<void> {
        this.registerListeners();
        await this.login(this.token);
    }

    private registerListeners(): void {
        this.client.on(Events.ClientReady, () => this.onReady());
        this.client.on(Events.ShardReady, (shardId: number, unavailableGuilds: Set<string>) =>
            this.onShardReady(shardId, unavailableGuilds)
        );
        this.client.on(Events.GuildCreate, (guild: Guild) => this.onGuildJoin(guild));
        this.client.on(Events.GuildDelete, (guild: Guild) => this.onGuildLeave(guild));
        this.client.on(Events.MessageCreate, (msg: Message) => this.onMessage(msg));
        this.client.on(Events.InteractionCreate, (intr: Interaction) => this.onInteraction(intr));
        this.client.on(
            Events.MessageReactionAdd,
            (messageReaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) =>
                this.onReaction(messageReaction, user)
        );
        this.client.rest.on(RESTEvents.RateLimited, (rateLimitData: RateLimitData) =>
            this.onRateLimit(rateLimitData)
        );
    }

    private async login(token: string): Promise<void> {
        try {
            await this.client.login(token);
        } catch (error) {
            Logger.error(Logs.error.clientLogin, error);
            return;
        }
    }

    private async onReady(): Promise<void> {
        let userTag = this.client.user?.tag;
        Logger.info(Logs.info.clientLogin.replaceAll('{USER_TAG}', userTag));

        if (!Debug.dummyMode.enabled) {
            this.jobService.start();
        }
        const banners = [
            'https://i.pinimg.com/originals/51/ab/d8/51abd821b2e8e1d95a1da81d0db16e8b.gif',
            'https://images-ext-1.discordapp.net/external/hCrrZZarSREsMoa2_QEsC5Boq_gDpWMJ_pW--Pk6KYw/%3Fsize%3D1024/https/cdn.discordapp.com/banners/1370183096938266644/a_961cd702e92d1005a9f3174cd2805be4.gif',
            'https://i.pinimg.com/originals/28/53/3e/28533ef14bb6b99eee94bc85560eb83f.gif',
            'https://i.pinimg.com/originals/a9/a9/ce/a9a9ce4d2e68819ef1f825b025347070.gif',
            'https://i.pinimg.com/originals/ad/f7/f4/adf7f40339edce3d813d443533b41d15.gif',
            'https://i.pinimg.com/originals/80/d9/74/80d9740c58e66c7698de024e244c40fb.gif',
            'https://i.pinimg.com/originals/a8/92/87/a8928706c21c5f8ebdf67552898fa04f.gif',
        ];
        const cl = this.client;
        changeBanner();
        setInterval(
            () => {
                changeBanner();
            },
            1000 * 60 * 5
        );
        async function changeBanner() {
            const bannerIndex = Math.floor(Math.random() * banners.length);
            const imageUrl = banners[bannerIndex];
            const response = await fetch(imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await cl.user.setBanner(buffer).catch(console.log);
            console.log('changed banner to ' + banners[bannerIndex]);
        }
        this.client.user.setPresence({
            activities: [
                {
                    name: 'Look at my banner',
                    type: 3,
                },
            ],
        });
        this.ready = true;
        Logger.info(Logs.info.clientReady);
    }

    private onShardReady(shardId: number, _unavailableGuilds: Set<string>): void {
        Logger.setShardId(shardId);
    }

    private async onGuildJoin(guild: Guild): Promise<void> {
        if (!this.ready || Debug.dummyMode.enabled) {
            return;
        }

        try {
            await this.guildJoinHandler.process(guild);
        } catch (error) {
            Logger.error(Logs.error.guildJoin, error);
        }
    }

    private async onGuildLeave(guild: Guild): Promise<void> {
        if (!this.ready || Debug.dummyMode.enabled) {
            return;
        }

        try {
            await this.guildLeaveHandler.process(guild);
        } catch (error) {
            Logger.error(Logs.error.guildLeave, error);
        }
    }

    private async onMessage(msg: Message): Promise<void> {
        if (
            !this.ready ||
            (Debug.dummyMode.enabled && !Debug.dummyMode.whitelist.includes(msg.author.id))
        ) {
            return;
        }

        try {
            msg = await PartialUtils.fillMessage(msg);
            if (!msg) {
                return;
            }

            await this.messageHandler.process(msg);
        } catch (error) {
            Logger.error(Logs.error.message, error);
        }
    }

    private async onInteraction(intr: Interaction): Promise<void> {
        if (
            !this.ready ||
            (Debug.dummyMode.enabled && !Debug.dummyMode.whitelist.includes(intr.user.id))
        ) {
            return;
        }

        if (intr instanceof CommandInteraction || intr instanceof AutocompleteInteraction) {
            try {
                await this.commandHandler.process(intr);
            } catch (error) {
                Logger.error(Logs.error.command, error);
            }
        } else if (intr instanceof ButtonInteraction) {
            try {
                await this.buttonHandler.process(intr);
            } catch (error) {
                Logger.error(Logs.error.button, error);
            }
        }
    }

    private async onReaction(
        msgReaction: MessageReaction | PartialMessageReaction,
        reactor: User | PartialUser
    ): Promise<void> {
        if (
            !this.ready ||
            (Debug.dummyMode.enabled && !Debug.dummyMode.whitelist.includes(reactor.id))
        ) {
            return;
        }

        try {
            msgReaction = await PartialUtils.fillReaction(msgReaction);
            if (!msgReaction) {
                return;
            }

            reactor = await PartialUtils.fillUser(reactor);
            if (!reactor) {
                return;
            }

            await this.reactionHandler.process(
                msgReaction,
                msgReaction.message as Message,
                reactor
            );
        } catch (error) {
            Logger.error(Logs.error.reaction, error);
        }
    }

    private async onRateLimit(rateLimitData: RateLimitData): Promise<void> {
        if (rateLimitData.timeToReset >= Config.logging.rateLimit.minTimeout * 1000) {
            Logger.error(Logs.error.apiRateLimit, rateLimitData);
        }
    }
}
