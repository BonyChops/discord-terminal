const Docker = require('dockerode');
const docker = new Docker();
const quote = require('shell-quote').quote;
const parse = require('shell-quote').parse;
const util = require('util');
const childProcess = require('child_process');
const exec = util.promisify(childProcess.exec);
const config = require("./config.json");
const merge = require("deepmerge");

class Container {
    constructor(option) {
        this.name = option.name;
        this.port = option.port;
        this.containerName = option.image + "-container"
        this.image = option.image;
        this.dockerConfig = option.dockerConfig;
        this.discordIcon = option.discordIcon
        this.authMethod = option.authMethod
    }

    getContainers = async () => {
        return await docker.listContainers({ all: true });
    }

    startContainer = async () => {
        console.log("checking")
        const containerInfo = (await this.getContainers()).find(containerInfo => containerInfo.Names.includes("/" + this.containerName));
        if (containerInfo?.State === "running") {
            return;
        }
        console.log("ok");
        let container;
        if (containerInfo === undefined) {
            console.log(this.name);
            const options = [{
                name: this.containerName,
                Image: this.image,
                Hostname: config.hostname,
                HostConfig: {
                    NetworkMode: "bridge",
                    PortBindings: {
                        "22/tcp": [
                            {
                                HostPort: String(this.port)
                            }
                        ]
                    }
                },
                AttachStdin: false,
                AttachStdout: false,
                AttachStderr: false,
                Tty: true,
                //Cmd: ['/bin/bash', '-c', 'echo "started"'],
                OpenStdin: false,
                StdinOnce: false,
            }];
            if (this.dockerConfig !== undefined) { options.push(this.dockerConfig) }
            const createOption = merge.all(options);
            container = await docker.createContainer(createOption);
            console.log(createOption);
            console.log("ok, created");
        } else {
            container = docker.getContainer(containerInfo.Id);
            console.log("Found!");
        }
        await container.start();
        return;
    }

    resetContainer = async () => {
        await exec(`ssh-keygen -f "/home/bonychops/.ssh/known_hosts" -R "[localhost]:${this.port}"`);
        let containerInfo = (await this.getContainers()).find(containerInfo => containerInfo.Names.includes("/" + this.containerName));
        console.log("loading")
        if (containerInfo !== undefined) {
            const container = docker.getContainer(containerInfo.Id);
            console.log("Stopping")
            try {
                await container.stop();
            } catch (e) { }
            await container.remove();
        }
        await this.startContainer();
    }

    sendCommand = async (user, command) => {
        await this.startContainer();
        console.log(`Sending command... ${command}`);

        const sshCommand = `${this.authMethod?.type === "password" ? `sshpass -p ${this.authMethod?.password} ` : ""}ssh -oStrictHostKeyChecking=no ${this.authMethod?.user === undefined ? user : this.authMethod?.user}@localhost -p ${this.port} -i ./docker/run/ssh_config/id_rsa ${quote([`sh -c ${quote([command])}`])}`
        console.log(sshCommand);
        const out = await exec(sshCommand);
        console.log("got it")
        return out;
    }
}

exports.Container = Container;