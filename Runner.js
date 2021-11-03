const { Container } = require("./Container");

const RUN = "discord-terminal-run";
const TIMEOUT = 3;
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
    constructor() {
        this.container = new Container(RUN);
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
            const currentDirectoryIndex = db.getIndex("/currentDirectories", username, "username");
            if (currentDirectoryIndex !== -1) {
                currentDirectory = db.getData(`/currentDirectories[${currentDirectoryIndex}]/currentDirectory`);
            }
        } catch (e) { }
        return currentDirectory;
    }

    checkUser = async (username) => {
        const users = await this.getUsers();
        if (!users.includes(username)) {
            await this.container.sendCommand("root", quote(["/root/generateUser.sh", username]));
        }
    }

    sendFile = async(username, sendUrl, fileName) => {
        await this.checkUser(username);
        const sendBuffer = new Buffer.from((await axios.get(sendUrl)).data);
        const client = new scpClient.Client({
            host: 'localhost',
            port: 8080,
            privateKey: fs.readFileSync('./docker/run/ssh_config/id_rsa'),
            username,
        });
        const tmpFilename = `discord_${new Date().getTime()}`;
        const currentDirectory = this.getCurrentDirectory(username);
        console.log(sendBuffer);
        console.log(typeof sendBuffer);
        await scpWrite(client, {
            destination: `${currentDirectory}/${tmpFilename}`,
            content: sendBuffer
        });
        console.log(["mv", `${currentDirectory}/${tmpFilename}`, `${currentDirectory}/${fileName}`]);
        await this.sendCommand(username, quote(["mv", `${currentDirectory}/${tmpFilename}`, `${currentDirectory}/${fileName}`]));
    }

    sendCommand = async (username, commandInput, args = []) => {
        await this.checkUser(username);
        const currentDirectory = this.getCurrentDirectory(username);
        await this.container.sendCommand(username, `mkdir -p /home/${username}/.${RUN}`);
        const client = new scpClient.Client({
            host: 'localhost',
            port: 8080,
            privateKey: fs.readFileSync('./docker/run/ssh_config/id_rsa'),
            username,
        });
        console.log(commandInput);
        await scpWrite(client, {
            destination: `/home/${username}/.${RUN}/bufCommand.zsh`,
            content: Buffer.from(commandInput + `\npwd > /home/${username}/.${RUN}/bufCurrent`)
        })
        //const command = [["cd", currentDirectory], ["timeout", TIMEOUT, "sh", `/home/${username}/.${RUN}/bufCommand.sh`]].map(item => quote(item)).join(" ; ");
        const command = [["cd", currentDirectory], ["timeout", TIMEOUT, "zsh", `/home/${username}/.${RUN}/bufCommand.zsh`, ...args/* , "|", `textimg`, `-o`, `/home/${username}/.${RUN}/bufExport.png` */]].map((item, i) => i === 1 ? quote(item).replaceAll("\\|", "|") : quote(item)).join(" ; ");
        const result = await this.container.sendCommand(username, command);
        console.log(result);
        const stdoutPerLine = result.stdout.split("\n");
        const currentDirectoryAfter = (await this.container.sendCommand(username, `cat /home/${username}/.${RUN}/bufCurrent`)).stdout.split("\n")[0];
        //const imageBuffer = await scpRead(client, `/home/${username}/.${RUN}/bufExport.png`);
        let currentDirectoryIndex = -1;
        console.log(stdoutPerLine.at(-2));
        try {
            currentDirectoryIndex = db.getIndex("/currentDirectories", username, "username");
        } catch (e) { }
        db.push(`/currentDirectories[${currentDirectoryIndex !== -1 ? currentDirectoryIndex : ""}]`, {
            username,
            currentDirectory: currentDirectoryAfter
        });
        return ({
            stdout: stdoutPerLine.slice(0, -1).join("\n"),
            stderr: result.stderr,
            //image: imageBuffer
        })
    }

    showPrompt = async (username, channel) => {
        const currentDirectory = this.getCurrentDirectory(username);

        channel.send(`\`${username}@${config.hostname} | ${currentDirectory} >\``);
    }
}

exports.Runner = Runner;