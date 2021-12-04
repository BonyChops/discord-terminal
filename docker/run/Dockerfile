FROM ubuntu:20.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt update
RUN apt install -y openssh-server git curl zsh zsh-syntax-highlighting zsh-autosuggestions locales # build-essential
RUN mkdir /var/run/sshd
RUN echo 'root:rootpassws' | chpasswd
RUN chsh -s "$(which zsh)"
RUN sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
RUN git clone --depth=1 https://github.com/romkatv/powerlevel10k.git "${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/themes/powerlevel10k"
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
# RUN sed -i 's/#Port 22/Port 20022/' /etc/ssh/sshd_config
COPY ./ssh_config/id_rsa.pub /root/.ssh/authorized_keys

RUN locale-gen ja_JP.UTF-8
ENV LANG ja_JP.UTF-8
ENV LANGUAGE ja_JP:jp
ENV LC_ALL ja_JP.UTF-8
ENV TZ Asia/Tokyo

RUN apt install -y net-tools vim emacs nano gnuplot sudo
RUN apt install -y neofetch
RUN apt install -y gcc clang
RUN wget https://github.com/jiro4989/textimg/releases/download/v3.0.6/textimg_3.0.6_amd64.deb
RUN dpkg -i ./*.deb
RUN rm *.deb
RUN apt install -y fonts-noto-cjk
RUN apt install -y cowsay
RUN apt install -y locales-all

RUN apt install -y traceroute iputils-ping

# RUN echo "$USERNAME   ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
ENV GID=1000
ENV GROUPNAME=USER
RUN groupadd -g $GID $GROUPNAME
COPY ./files/ /root/

RUN chmod +x /root/generateUser.sh

EXPOSE 22
CMD ["/usr/sbin/sshd", "-D"]