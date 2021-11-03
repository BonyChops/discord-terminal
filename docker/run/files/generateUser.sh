export USERNAME="$1"
export GROUPNAME="USER"
export UID=1000
export GID=1000
export PASSWORD=user
useradd -m -s /bin/bash -g $GID -G sudo $USERNAME
echo $USERNAME:$PASSWORD | chpasswd
echo "$USERNAME   ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
chsh -s "$(which zsh)" $USERNAME
cd /root/
cp .zshrc .p10k.zsh "/home/$USERNAME"
cp -r .oh-my-zsh "/home/$USERNAME/.oh-my-zsh"
chown "$USERNAME:$GROUPNAME" /home/$USERNAME/.*
cp /root/.ssh -r "/home/$USERNAME/.ssh"
chown "$USERNAME:$GROUPNAME" "/home/$USERNAME/.ssh"
chown "$USERNAME:$GROUPNAME" /home/$USERNAME/.ssh/*
echo "User $1 generated"