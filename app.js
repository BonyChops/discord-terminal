const RUN = "discord-terminal-run";
const TIMEOUT = 3;

const { Client, Intents, MessageAttachment, MessageActionRow, MessageButton } = require('discord.js');
const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILD_MEMBERS],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});
const util = require('util');
const childProcess = require('child_process');
const config = require("./config.json");
const { db } = require("./db");
db.reload();
const input = require("input");
const Kuroshiro = require("kuroshiro");
const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");
const kuroshiro = new Kuroshiro();
const cowsay = require("cowsay");
const fs = require("fs");
let allowedGuilds = [];
const parse = require('shell-quote').parse;

const { Runner } = require("./Runner");
const { Container } = require("./Container");
//const quote = require('shell-escape');

const validUserName = async (nameBuf) => {
    const linuxUserPattern = /[a-z_]([a-z0-9_-]{0,31}|[a-z0-9_-]{0,30}\$)/;
    let name = nameBuf.toLowerCase();
    if (linuxUserPattern.test(name)) {
        return name;
    }

    try {
        const cacheIndex = db.getIndex("/nameCache", name, "beforeConvert");
        if (cacheIndex !== -1) {
            const cache = db.getData(`/nameCache[${cacheIndex}]`);
            if (cache !== undefined) {
                return cache.afterConvert;
            }
        }

    } catch (e) {
        /* console.error(e); */
    }
    const beforeConvert = name;

    await kuroshiro.init(new KuromojiAnalyzer());
    // Convert what you want
    name = await kuroshiro.convert(name, { to: "romaji", romajiSystem: "passport" });
    name = name.replaceAll(/[^a-z0-9_-]/g, "");
    if (linuxUserPattern.test(name)) {
        test = `user${Math.floor(Math.random() * 9999)}`;
    }
    db.push("/nameCache[]", {
        beforeConvert,
        afterConvert: name
    });
    return name;
}

const runnerContainers = config.containers.map(container => new Runner(container));


client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(await validUserName("篠("));
    allowedGuilds = config.terminalChannel.map(channel => channel.id).map(id => client.guilds.cache.find(guild => guild.channels.cache.some(channel => channel.id === id))).filter(guild => guild !== undefined);
    return;
    for (; ;) {
        const ans = await input.select(["GET_USERS", "RESET_CONTAINER", "SEND_COMMAND"]);
        await ({
            GET_USERS: async () => {
                await runnerContainer.getUsers();
            },
            RESET_CONTAINER: async () => {
                await runnerContainer.resetContainer();
            },
            SEND_COMMAND: async () => {
                const user = await input.text("User?");
                const command = await input.text("Command?");
                const result = await runnerContainer.sendCommand(user, command);
                console.log(result);
            }
        })[ans]();
    }
});

const eula = `
\`\`\`
${cowsay.say({ text: `${config.terminalName}へようこそ！` })}
\`\`\`
${fs.readFileSync("./eula.txt")}
`

const getContainer = (username) => {
    let result;
    try {
        const userIndex = db.getIndex("/containerCache", username, "username");
        if (userIndex === -1) {
            throw new Error("No data found");
        }
        result = db.getData(`/containerCache[${userIndex}]/containerName`);
    } catch (e) {
        return runnerContainers[0];
    }
    const runnerContainer = runnerContainers.find(runner => runner.container.name === result);
    return runnerContainer === undefined ? runnerContainers[0] : runnerContainer;
}

const runCommand = async (msg, username, command, args = [], disablePrompt = false) => {
    let result;
    const runnerContainer = getContainer(username);
    try {
        await msg.channel.sendTyping();
        result = await runnerContainer.sendCommand(username, command, args);
    } catch (e) {
        console.log(e.toString());
        if (e.code === 124) {
            msg.channel.send("```処理がタイムアウトしました```");
            result = e;
        } else if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
            msg.channel.send("```出力文字が多すぎるため，一部が欠けている可能性があります```");
            result = e;
        } else {
            if (!disablePrompt) {
                try {
                    runnerContainer.showPrompt(username, msg.channel);
                } catch (e) { }
                return;
            }
        }
    }
    let resultStr = "";
    if (result.stdout !== "") {
        resultStr += `\`\`\`\n${result.stdout} \n\`\`\`\n`;
    }
    if (result.stderr !== "") {
        resultStr += `\`\`\`\n${result.stderr}\n\`\`\`\n`;
    }
    try {
        if (resultStr !== "") {
            msg.channel.send((resultStr.length >= 2000 ? {
                files: [{
                    attachment: Buffer.from(resultStr, 'utf8'),
                    name: 'result.txt'
                }]
            } : {
                content: resultStr,
                /* files: [{
                    attachment: result.image,
                    name: 'result.png'
                }] */
            }));
        }
        if (!disablePrompt) {
            runnerContainer.showPrompt(username, msg.channel);
        }
    } catch (e) { console.log(e); }
}

client.on('messageCreate', async (msg) => {
    if (msg.author.id === client.user.id) return;
    /*  if (msg.channel.type === "DM") {
         if()){
             msg.channel.send("このbotは認可されたユーザしか使用することはできません．");
         }else{
             msg.channel.send("このbotは認可されたユーザしか使用することはできません．");
         }
     } */
    if (
        config.terminalChannel.some(channel => channel.id === String(msg.channel.id))
        || (msg.channel.type === "DM")
    ) {
        let username;
        if (msg.channel.type === "DM") {
            console.log(allowedGuilds[0].members.cache);
            if (!allowedGuilds.some(guild => guild.members.cache.find(member => member.id === msg.author.id))) {
                msg.channel.send("**__Permission Denied__**\nこのbotは認可されたユーザしか使用することはできません\n\n[詳細]:\nあなたが許可されたサーバーのメンバーであることを確認できませんでした．一度，鯖の共用ターミナルを使うか，鯖内で会話をしてみてください．");
                return;
            } else {
                username = await validUserName(msg.author.username);
            }
        } else {
            const channel = config.terminalChannel.find(channel => channel.id === String(msg.channel.id));
            username = await validUserName(channel.user);
        }
        const runnerContainer = getContainer(username);
        if (!runnerContainer.eulaChecked(msg.author.id)) {
            const row = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('eulaAccept')
                        .setLabel('わかりました')
                        .setStyle('PRIMARY'),
                );
            const disabledRow = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setDisabled(true)
                        .setLabel('同意済み')
                        .setStyle('PRIMARY')
                );

            await msg.channel.send({ content: `<@!${msg.author.id}>\n` + eula, components: [row] });
        } else {
            const separateCommands = msg.content.split(/\s|\n/);
            console.log(separateCommands);
            if (separateCommands[0] === config.commandPrefix) {
                switch (separateCommands[1]) {
                    case "reset":
                        const row = new MessageActionRow()
                            .addComponents(
                                new MessageButton()
                                    .setCustomId('resetContainer')
                                    .setLabel('リセット')
                                    .setStyle('DANGER'),
                            );
                        await msg.channel.send({ content: `<@!${msg.author.id}>\n**Linux環境をリセットします**\n進行中の作業は全て失われ，ファイルは初期状態にもどりますがよろしいですか？`, components: [row] });
                        break;
                    case "workflow":
                        switch (separateCommands[2]) {
                            case "set":
                                if (separateCommands[3] === undefined) {
                                    msg.channel.send("Set workflow name");
                                    return;
                                }
                                const shell = msg.content.substr(msg.content.indexOf(separateCommands[3]) + separateCommands[3].length).replace(/```.*/ig, "");
                                db.push(`/workflows/${separateCommands[3]}`, { shell, name: separateCommands[3] });
                                msg.channel.send(`Workflow:${separateCommands[3]} set`);
                                break;

                            default:
                                msg.channel.send(`option ${separateCommands[2]} not found`);
                                return;
                        }
                        break;
                }
            } else {
                if (msg.attachments.size > 0) {
                    await Promise.all(msg.attachments.map(attachment => runnerContainer.sendFile(username, attachment.url, attachment.name)));
                    msg.channel.send("```done```");
                } else {
                    await runCommand(msg, username, msg.content);
                    /* let result;
                    try {
                        await msg.channel.sendTyping();
                        result = await runnerContainer.sendCommand(username, msg.content);
                    } catch (e) {
                        console.log(e.toString());
                        if (e.code === 124) {
                            msg.channel.send("```処理がタイムアウトしました```");
                            result = e;
                        } else if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
                            msg.channel.send("```出力文字が多すぎるため，一部が欠けている可能性があります```");
                            result = e;
                        } else {
                            try {
                                runnerContainer.showPrompt(username, msg.channel);
                            } catch (e) { }
                            return;
                        }
                    }
                    let resultStr = "";
                    if (result.stdout !== "") {
                        resultStr += `\`\`\`\n${result.stdout} \n\`\`\`\n`;
                    }
                    if (result.stderr !== "") {
                        resultStr += `\`\`\`\n${result.stderr}\n\`\`\`\n`;
                    }
                    try {
                        if (resultStr !== "") {
                            msg.channel.send((resultStr.length >= 2000 ? {
                                files: [{
                                    attachment: Buffer.from(resultStr, 'utf8'),
                                    name: 'result.txt'
                                }]
                            } : {
                                content: resultStr,
                                files: [{
                                    attachment: result.image,
                                    name: 'result.png'
                                }]
                }));
                        }
                    runnerContainer.showPrompt(username, msg.channel);
                    } catch (e) { console.log(e); } */
                }

            }
        }
    } else {
        //workflow
        const args = parse(msg.content);
        console.log(args);
        console.log(args[0].length);
        if (args[0].length < 2) {
            return;
        }
        let workflow;
        try {
            console.log(`/workflows/${args[0].substr(1)}`);
            workflow = db.getData(`/workflows/${args[0].substr(1)}`);
            //workflow = db.getData(`/workflows`);
        } catch (e) { console.log(e); return; }
        console.log(workflow);
        await runCommand(msg, "workflow", workflow.shell, args.slice(1), true);
    }
})

client.on('interactionCreate', async (interaction) => {
    const disabledAcceptRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setDisabled(true)
                .setCustomId('eulaAccept')
                .setLabel('✅同意済み')
                .setStyle('SUCCESS')
        );
    const disabledResetRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('resetContainer')
                .setLabel('リセット')
                .setStyle('DANGER')
                .setDisabled(true),
        );
    if (!interaction.isButton()) return;
    console.log(interaction);
    const username = await validUserName(interaction.channel.type === "DM" ? interaction.user.username : channel.user);
    const runnerContainer = getContainer(username);
    if (interaction.customId === 'eulaAccept') {
        await interaction.update({ content: eula, components: [disabledAcceptRow] });
        const channel = config.terminalChannel.find(channel => channel.id === String(interaction.channel.id));
        db.push("/eulaChecked[]", {
            username: interaction.user.id
        });
    } else if (interaction.customId === "resetContainer") {
        try {
            await runnerContainer.resetContainer();
        } catch (e) {
            console.error(e);
            await interaction.channel.send("リセットに失敗しました...");
            return;
        }
        await interaction.update({ components: [disabledResetRow] });
        await interaction.channel.send("環境をリセットしました．");
        db.delete("/currentDirectories");
    }
    const channel = config.terminalChannel.find(channel => channel.id === String(interaction.channel.id));
    runnerContainer.showPrompt(username, interaction.channel)
});


client.login(config.token);