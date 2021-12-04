const { Container } = require("./Container");

const RUN = "discord-terminal-run";
const TIMEOUT = 15;
const util = require('util');
const childProcess = require('child_process');
const quote = require('shell-quote').quote;
const parse = require('shell-quote').parse;
const fs = require("fs");
const exec = util.promisify(childProcess.exec);
const { db } = require("./db");
const scpClient = require('scp2');
const config = require("./config.json");
const axios = require("axios");

const scpWrite = (client, option) => (new Promise((resolve, reject) => {
    client.write(option, function (err) {
        client.close();
        if (err) {
            reject(err);
        }
        resolve();
    });
}));



const scpRead = (client, src) => (new Promise((resolve, reject) => {
    client.read(src, function (buffer, err) {
        if (err) {
            reject(err);
        }
        resolve(buffer);
    })
}))

class Runner {
    constructor(option) {
        this.container = new Container(option);
    }

    eulaChecked = (username) => {
        try {
            const index = db.getIndex("/eulaChecked", username, "username");
            if (index === -1) {
                return false;
            }
        } catch (e) {
            console.error(e);
            return false;
        }
        return true;
    }

    getUsers = async () => {
        const result = (await this.container.sendCommand("root", "cat /etc/passwd")).stdout.split("\n").slice(0, -1).join("\n");
        return result.split("\n").map(item => item.split(":")[0]);
    }

    resetContainer = async () => {
        await this.container.resetContainer();
    }

    getCurrentDirectory = (username) => {
        let currentDirectory = `/home/${username}`;
        try {
            currentDirectory = db.getData(`/currentDirectories/${username}/${this.container.image}`);
        } catch (e) { console.error(e) }
        return currentDirectory;
    }

    checkUser = async (username) => {
        const users = await this.getUsers();
        if (!users.includes(username)) {
            await this.container.sendCommand("root", quote(["/root/generateUser.sh", username]));
        }
    }

    sendFile = async (username, sendThing, fileName, realname = undefined) => {
        realname ??= username;
        await this.checkUser(username);
        const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
        const sendBuffer = new Buffer.from(urlRegex.test(sendThing) ? (await axios.get(sendThing)).data : sendThing);
        const client = new scpClient.Client({
            host: 'localhost',
            port: this.container.port,
            privateKey: fs.readFileSync('./docker/run/ssh_config/id_rsa'),
            password: this.container.authMethod?.password,
            username,
        });
        const tmpFilename = `discord_${new Date().getTime()}`;
        const currentDirectory = this.getCurrentDirectory(realname);
        console.log(sendBuffer);
        console.log(typeof sendBuffer);
        await scpWrite(client, {
            destination: `${currentDirectory}/${tmpFilename}`,
            content: sendBuffer
        });
        console.log(["mv", `${currentDirectory}/${tmpFilename}`, `${currentDirectory}/${fileName}`]);
        await this.sendCommand(username, quote(["mv", `${currentDirectory}/${tmpFilename}`, `${currentDirectory}/${fileName}`]));
        return `${currentDirectory}/${fileName}`;
    }

    getFile = async (username, src) => {
        console.log(src);
        const client = new scpClient.Client({
            host: 'localhost',
            port: this.container.port,
            privateKey: fs.readFileSync('./docker/run/ssh_config/id_rsa'),
            username,
            password: this.container.authMethod?.password
        });
        return await scpRead(client, src);
    }

    sendCommand = async (username, commandInput, args = []) => {
        const realname = username;
        console.log("myname is:", username)
        if (this.container.authMethod?.user !== undefined) { username = this.container.authMethod?.user; }
        console.log(this.container)
        await this.checkUser(username);
        const currentDirectory = this.getCurrentDirectory(realname);
        await this.container.sendCommand(username, `mkdir -p /home/${username}/.${RUN}`);
        const client = new scpClient.Client({
            host: 'localhost',
            port: this.container.port,
            privateKey: fs.readFileSync('./docker/run/ssh_config/id_rsa'),
            password: this.container.authMethod?.password,
            username,
        });
        console.log(commandInput);
        await scpWrite(client, {
            destination: `/home/${username}/.${RUN}/bufCommand.sh`,
            content: Buffer.from(commandInput + `\npwd > /home/${username}/.${RUN}/bufCurrent`)
        })
        //const command = [["cd", currentDirectory], ["timeout", TIMEOUT, "sh", `/home/${username}/.${RUN}/bufCommand.sh`]].map(item => quote(item)).join(" ; ");
        const command = [["cd", currentDirectory], ["timeout", TIMEOUT, "sh", `/home/${username}/.${RUN}/bufCommand.sh`, ...args/* , "|", `textimg`, `-o`, `/home/${username}/.${RUN}/bufExport.png` */]].map((item, i) => i === 1 ? quote(item).replaceAll("\\|", "|") : quote(item)).join(" ; ");
        const result = await this.container.sendCommand(username, command);
        console.log(result);
        const stdoutPerLine = result.stdout.split("\n");
        const currentDirectoryAfter = (await this.container.sendCommand(username, `cat /home/${username}/.${RUN}/bufCurrent`)).stdout.split("\n")[0];
        //const imageBuffer = await scpRead(client, `/home/${username}/.${RUN}/bufExport.png`);
        let currentDirectoryIndex = -1;
        console.log(stdoutPerLine.at(-2));
        db.push(`/currentDirectories/${realname}/${this.container.image}`, currentDirectoryAfter);
        return ({
            stdout: stdoutPerLine.slice(0, -1).join("\n"),
            stderr: result.stderr,
            //image: imageBuffer
        })
    }

    showPrompt = async (username, channel) => {
        const currentDirectory = this.getCurrentDirectory(username);
        const containerIdentify = this.container.discordIcon === undefined ? `[${this.container.name}]` : this.container.discordIcon
        const prompt = `${containerIdentify} \`${this.container.authMethod?.user === undefined ? username : this.container.authMethod?.user}@${config.hostname} | ${currentDirectory} >\``;
        console.log(prompt)
        channel.send(prompt);
    }
}

exports.Runner = Runner;