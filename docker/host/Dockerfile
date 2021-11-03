FROM ubuntu:20.04
ENV DEBIAN_FRONTEND=noninteractive

# Install node
RUN apt update
RUN apt install -y nodejs npm
RUN npm install n -g
RUN apt install curl wget -y
RUN n stable
RUN apt purge -y nodejs npm
# Delete cache
RUN apt-get clean autoclean
RUN apt-get autoremove --yes
RUN rm -rf /var/lib/{apt,dpkg,cache,log}/
RUN apt install -y openssh-server
RUN apt install -y zsh zsh-syntax-highlighting zsh-autosuggestions git
RUN echo 'root:rootpassws' | chpasswd
RUN chsh -s "$(which zsh)"
RUN sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
RUN git clone --depth=1 https://github.com/romkatv/powerlevel10k.git "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k"
# これが無いとsshdが起動しないっぽい
RUN mkdir /var/run/sshd
# rootのパスワードをrootpasswdに設定します。ただし、公開鍵認証でのアクセスなので使用しませんが。。
RUN echo 'root:rootpassws' | chpasswd
# sshのrootでのアクセスを許可します。ただし、パスワードでのアクセスは無効
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config

COPY ./files/ /root/