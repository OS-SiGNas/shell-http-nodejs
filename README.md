# HTTP SHELL!

This is a simple Http Shell written in typescript, which does not depend on external libraries such as express, fastify or koa; is a simple script that uses nodejs native http; it consists of only 4 GET endpoints, **/sh** to run commands, and **/file** to view files.

## /sh

this endpoint receive command query in the url, like **/sh?command=ls** or **/sh?command=cat%20file.txt**

## /file

this endpoint receive file path like **/file?name=/home/user/image.png**

## /info

this endpoint return system info

## /status

this endpoint return 204 status code

## how to use?

the script receives a 'port' argument

`$ node shell-http.min.mjs 3000`

if you don't specify a port, 0 will be used by default, this will use a random free port
