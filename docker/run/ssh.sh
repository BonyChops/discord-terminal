ssh root@localhost -p 8080 -i ./docker/run/ssh_config/id_rsa 'zsh -c "cat /etc/passwd && echo && pwd"'