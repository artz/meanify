# meanify example

This example demonstrates a basic meanify setup.

First, run `npm install` in this directory (`example`).

Then, run the following to start the server in debug mode:

```
➜ DEBUG=meanify node server.js
```
If successful, you should see the following output:

```
  meanify GET    /api/users +0ms
  meanify POST   /api/users +1ms
  meanify GET    /api/users/:id +0ms
  meanify POST   /api/users/:id +0ms
  meanify DELETE /api/users/:id +0ms
  meanify GET    /api/posts +0ms
  meanify POST   /api/posts +1ms
  meanify GET    /api/posts/:id +0ms
  meanify POST   /api/posts/:id +0ms
  meanify DELETE /api/posts/:id +0ms
```
The service is running at http://localhost:3001/api.

Play around using a tool such as [Postman](https://chrome.google.com/webstore/detail/postman-rest-client/fdmmgilgnpjigdojojpjoooidkmcomcm) to try out the various endpoints and options detailed in the [meanify README](https://github.com/artzstudio/meanify/blob/master/README.md).

Example URLs:

* [http://localhost:3001/api/users](http://localhost:3001/api/users)
* [http://localhost:3001/api/users?__count](http://localhost:3001/api/users?__count)
