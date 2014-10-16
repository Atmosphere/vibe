---
layout: project
title: Vibe Java Server Reference
---

<h1>Reference</h1>

---

**Table of Contents**

* [Installation](#installation)
* [Server](#server)
    * [Handling Socket](#handling-socket)
    * [Selecting Sockets](#selecting-sockets)
    * [Writing Sentence](#writing-sentence)
* [Socket](#socket)
    * [Life Cycle](#life-cycle)
    * [Properties](#properties)
    * [Tagging](#tagging)
    * [Sending and Receiving Event](#sending-and-receiving-event)
    * [Getting and Setting Result of Event Processing](#getting-and-setting-result-of-event-processing)
    * [Accessing Platform-Specific Object](#accessing-platform-specific-object)
* [Integration](#integration)
    * [Dependency Injection Framework](#dependency-injection-framework)
    * [Message Oriented Middleware](#message-oriented-middleware)
    
---

## Installation
Vibe Java Server requires Java 7 and is distributed through Maven Central. Add the following dependency to your build or include it on your classpath manually.

```xml
<dependencies>
    <dependency>
        <groupId>org.atmosphere</groupId>
        <artifactId>vibe-server</artifactId>
        <version>3.0.0-Alpha2</version>
    </dependency>
</dependencies>
```

[Vibe Java Platform](/projects/vibe-java-platform/) is created to run a vibe application on any framework or server transparently without or with a little bit of effort. See [reference guide](/projects/vibe-java-platform/3.0.0-Alpha2/reference/) for what platforms are supported, how to install vibe on them and what you can do when your favorite platform is not supported.

---

## Server
Server is a vibe application in a nutshell producing and managing socket consuming HTTP exchange and WebSocket.

### Handling Socket
When a socket is opened, actions added via `socketAction(Action<ServerSocket> action)` are executed with it. It's allowed to add several actions before and after installation, so you don't need to centralize all your code to one class.

```java
server.socketAction(new Action<ServerSocket>() {
    @Override
    public void on(ServerSocket socket) {
        // Your logic here
    }
});
```

### Selecting Sockets
It's a common use case to select some sockets and do something with them like dealing with persistence entities or HTML elements. When a socket has been closed, it is evicted from the server immediately, so socket being passed to action is always in the open state where I/O operations are available.

#### All
`all(Action<ServerSocket> action)` executes the given action finding all of the socket in this server.

```java
server.all(new Action<ServerSocket>() {
    @Override
    public void on(ServerSocket socket) {
        // Your logic here
    }
});
```

#### By Id
Every socket has a unique id. `byId(String id, Action<ServerSocket> action)` finds socket by id and executes the given action only once or not if no socket is found.

```java
server.byId("59f3e826-3684-4e0e-813d-8394ac7fb7c0", new Action<ServerSocket>() {
    @Override
    public void on(ServerSocket socket) {
        // Your logic here
    }
});
```

#### By Tag
A socket may have several tags and a tag may have several sockets like many-to-many relationship. `byTag(String[] names, Action<ServerSocket> action)` finds socket accepting one or more tag names and executes the given action.

```java
server.byTag("room#201", new Action<ServerSocket>() {
    @Override
    public void on(ServerSocket socket) {
        // Your logic here
    }
});
```

### Writing Sentence
`Sentence` is a fluent interface to deal with a group of sockets. Finder methods return a sentence when being called without action. Use of sentence is preferred to that of action if the goal is same. Because, it enables to write one-liner action and uses an action implementing `Serializable` in execution, which is picky to use in anonymous class and typically needed in clustering.

```java
server.all().send("foo", "bar");
```
```java
server.byTag("room#201", "room#301").send("message", "time to say goodbye").close();
```

---

## Socket
Socket is a connectivity between the two vibe endpoints where event occurs.

### Life Cycle
Socket can be in opened state where I/O operations are possible or closed state where `close` event fires and I/O operations are not possible but it is always expected in the opened state. In other words, do not hold a reference on socket unless the reference shares the same life cycle of socket. It makes things complicated since it is stateful and also may result in a problem in clustered environment.

**Note**

* To access socket always create a socket action and pass it to server.
* Otherwise do something on socket's `close` event.

### Properties
These are read only.

<div class="row">
<div class="large-4 columns">
{% capture panel %}
#### Id
A unique identifier in the form of UUID generated by client by default.

```java
socket.id();
```
{% endcapture %}{{ panel | markdownify }}
</div>
<div class="large-4 columns">
{% capture panel %}
#### URI
A URI used to connect. To work with URI parts, use `java.net.URI` or something like that.

```java
URI.create(socket.uri()).getQuery();
```
{% endcapture %}{{ panel | markdownify }}
</div>
<div class="large-4 columns">
{% capture panel %}
#### Tags
A set of tag names. It's modifiable, deal with it as a plain set.

```java
Set<String> tags = socket.tags();
tags.add("account#flowersinthesand");
```
{% endcapture %}{{ panel | markdownify }}
</div>
</div>

### Tagging
As a socket is a just connectivity, id is not suibtable for handling a specific entity in the real world. For example, when an user signs in using multiple devices, if someone sends a message, it should be delivered to all devices where the user signed in. To do that, using id is annoying and error-prone.

That's why tag is introduced. A tag is used to point to a group of sockets like class attribute in HTML. Tag set is managed only by server and unknown to client. `tag(String... names)`/`untag(String... names)` attcahes/detaches given names of tags to/from a socket.

<div class="row">
<div class="large-6 columns">
{% capture panel %}
**Tagging**

```java
server.socketAction(new Action<ServerSocket>() {
    @Override
    public void on(final ServerSocket socket) {
        socket.tag(Uris.parse(socket.uri()).param("username"));
    }
});
```
{% endcapture %}{{ panel | markdownify }}
</div>
<div class="large-6 columns">
{% capture panel %}
**Using tag**

```java
public class EntityListener {
    @Inject
    Server server;
    
    @PostUpdate
    public void notifyAccount(Account account) {
        server.byTag(account.username()).send("/account/update", account);
    }
}
```
{% endcapture %}{{ panel | markdownify }}
</div>
</div>

### Sending and Receiving Event
`on(String event, Action<T> action)` attaches an event handler. The `close` event is the only reserved event, which fires when a socket has been clsoed. In receiving events, the allowed Java types, `T`, for data are corresponding to JSON types:

| Number | String | Boolean | Array | Object | null |
|---|---|---|---|---|---|
|`Integer` or `Double` | `String` | `Boolean` | `List<T>` | `Map<String, T>` | `null` or `Void` |

`send(String event)` and `send(String event, Object data)` sends an event with or without data, respectively. Unlike when receiving event, when sending event you can use any type of data.

**Note**

* To manage a lot of events easily, use [URI](http://tools.ietf.org/html/rfc3986) as event name format like `/account/update`.

_The client sends events and the server echoes back to the client._

<div class="row">
<div class="large-6 columns">
{% capture panel %}
**Server**

```java
server.socketAction(new Action<ServerSocket>() {
    @Override
    public void on(final ServerSocket socket) {
        socket.on("echo", new Action<Object>() {
            @Override
            public void on(Object data) {
                System.out.println(data);
                socket.send("echo", data);
            }
        });
    }
});
```
{% endcapture %}{{ panel | markdownify }}
</div>
<div class="large-6 columns">
{% capture panel %}
**Client**

```javascript
client.open("http://localhost:8080/vibe", {transport: "ws"})
.on("open", function() {
    this.send("echo", Math.PI)
    .send("echo", "pi")
    .send("echo", {"p": "i"})
    .send("echo", ["p", "i"]);
})
.on("echo", function(data) {
    console.log(data);
});
```
{% endcapture %}{{ panel | markdownify }}
</div>
</div>

_The server sends events and the client echoes back to the server._

<div class="row">
<div class="large-6 columns">
{% capture panel %}
**Server**

```java
server.socketAction(new Action<ServerSocket>() {
    @Override
    public void on(final ServerSocket socket) {
        socket.on("echo", new Action<Object>() {
            @Override
            public void on(Object data) {
                System.out.println(data);
            }
        })
        .send("echo", Math.PI)
        .send("ehco", "pi")
        .send("echo", new HashMap<String, String>() { { put("p", "i"); } })
        .send("echo", Arrays.asList(new String[] {"p", "i"}));
    }
});
```
{% endcapture %}{{ panel | markdownify }}
</div>
<div class="large-6 columns">
{% capture panel %}
**Client**

```javascript
client.open("http://localhost:8080/vibe", {transport: "ws"})
.on("echo", function(data) {
    console.log(data);
    this.send("echo", data);
})
```
{% endcapture %}{{ panel | markdownify }}
</div>
</div>

### Getting and Setting Result of Event Processing
You can get the result of event processing from the client in sending event using `send(String event, Object data, Action<T> resolved)` and `send(String event, Object data, Action<T> resolved, Action<U> rejected)` where the allowed Java types, `T`, are the same with in receiving event, and set the result of event processing to the client in receiving event by using `Reply` as data type in an asynchronous manner. Either resolved or rejected callback is executed once when the counterpart executes it. You can apply this functionality to sending events in order, Acknowledgements, Remote Procedure Call and so on.

**Note**

* Beforehand determine whether to use rejected callback or not to avoid writing unnecessary rejected callbacks.

_The client sends events attaching callbacks and the server executes one of them with the result of event processing._

<div class="row">
<div class="large-6 columns">
{% capture panel %}
**Server**

```java
server.socketAction(new Action<ServerSocket>() {
    @Override
    public void on(final ServerSocket socket) {
        socket.on("/account/find", new Action<Reply<String>>() {
            @Override
            public void on(Reply<String> reply) {
                String id = reply.data();
                System.out.println(id);
                try {
                    reply.resolve(Account.find.byId(id));
                } catch(EntityNotFoundException e) {
                    reply.reject("¯\(°_o)/¯");
                }
            }
        });
    }
});
```
{% endcapture %}{{ panel | markdownify }}
</div>
<div class="large-6 columns">
{% capture panel %}
**Client**

```javascript
client.open("http://localhost:8080/vibe", {transport: "ws"})
.on("open", function(data) {
    this.send("/account/find", "flowersinthesand", function(data) {
        console.log("resolved with " + data);
    }, function(data) {
        console.log("rejected with " + data);
    })
    .send("/account/find", "flowersits", function(data) {
        console.log("resolved with " + data);
    }, function(data) {
        console.log("rejected with " + data);
    });
});
```
{% endcapture %}{{ panel | markdownify }}
</div>
</div>

_The server sends events attaching callbacks and the client executes one of them with the result of event processing._

<div class="row">
<div class="large-6 columns">
{% capture panel %}
**Server**

```java
server.socketAction(new Action<ServerSocket>() {
    @Override
    public void on(final ServerSocket socket) {
        socket.send("/account/find", "flowersinthesand", new Action<Map<String, Object>>() {
            @Override
            public void on(Map<String, Object> data) {
                System.out.println("resolved with " + data);
            }
        }, new Action<String>() {
            @Override
            public void on(String data) {
                System.out.println("rejected with " + data);
            }
        })
        .send("/account/find", "flowersits", new Action<Map<String, Object>>() {
            @Override
            public void on(Map<String, Object> data) {
                System.out.println("resolved with " + data);
            }
        }, new Action<String>() {
            @Override
            public void on(String data) {
                System.out.println("rejected with " + data);
            }
        });
    }
});
```
{% endcapture %}{{ panel | markdownify }}
</div>
<div class="large-6 columns">
{% capture panel %}
**Client**

```javascript
client.open("http://localhost:8080/vibe", {transport: "ws"})
.on("/account/find", function(id, reply) {
    console.log(id);
    if (id === "flowersinthesand") {
        reply.resolve({name: "Donghwan Kim"});
    } else {
        reply.reject("¯\(°_o)/¯");
    }
});
```
{% endcapture %}{{ panel | markdownify }}
</div>
</div>

### Accessing Platform-Specific Object
In any case, platform-specific objects like HTTP request and WebSocket underlie a socket and sometimes you need to access those objects, for example to get some attributes from a session where a socket is associated. Then you can access them using `unwrap(Class<?> clazz)`.

_Accessing HttpSession on Atmosphere._

```java
HttpSession session = socket.unwrap(AtmosphereResource.class).getRequest().getSession();
```

_Accessing HttpSession on Servlet._

```java
HttpSession session = socket.unwrap(HttpServletRequest.class).getSession();
```

**Note**

* The purpose of `unwrap(Class<?> clazz)` is to get such a platform-specific object like session only and not to manipulate them.
* Authentication is a high-level concept involving many other issues like choosing an authentication method, implementing that method and making it work in a clustered environment, and your platform or framework may have done for you in their own way. Overall approaches and examples will be added following [Authentication feature](https://github.com/vibe-project/vibe-protocol/issues/25).

---

## Integration
Here is how to integrate Vibe Java Server with awesome technologies.

### Dependency Injection Framework
With the help of Dependency Injection (DI) framework like Spring and Guice, you can inject Server wherever you need like the following cases:

<div class="row">
<div class="large-6 columns">
{% capture panel %}
_Making Server as component._

```java
@Configuration
public class Config {
    @Bean
    public Server server() {
        return new DefaultServer();
    }
}
```
{% endcapture %}{{ panel | markdownify }}
</div>
<div class="large-6 columns">
{% capture panel %}
_Integrating with I/O platform._

```java
@Component
public class Feeder {
    @Autowired
    private Server server;

    @OnHttpExchange("/vibe")
    public void http(HttpExchange http) {
        server.httpAction().on(new MyServerHttpExchange(http));
    }

    @OnWebSocket("/vibe")
    public void ws(WebSocket ws) {
        server.websocketAction().on(new MyServerWebSocket(ws));
    }
}
```
{% endcapture %}{{ panel | markdownify }}
</div>
</div>

<div class="row">
<div class="large-6 columns">
{% capture panel %}
_Handling socket._

```java
@Controller
public class Handler {
    @Autowired
    private Server server;
    
    @PostConstruct
    public void handle() {
        server.socketAction(new Action<ServerSocket>() {
            @Override
            public void on(ServerSocket socket) {
                socket.tag("tag");
            }
        });
    }
}
```
{% endcapture %}{{ panel | markdownify }}
</div>
<div class="large-6 columns">
{% capture panel %}
_Sending event._

```java
@Component
public class AccountEntityListener {
    @Autowired
    private Server server;

    @PostUpdate
    public void update(Account account) {
        server.byTag("account#" + account.id()).send("update", account);
    }
}
```
{% endcapture %}{{ panel | markdownify }}
</div>
</div>



### Message Oriented Middleware

All of the Message Oriented Middleware (MOM) supporting publish and subscribe model like JMS and Hazelcast can be used to cluster multiple vibe applications by using `ClusteredServer`.

`ClusteredServer` intercepts a call to `all`, `byId` and `byTag`, converts the call into a message and pass the message to actions added via `publishAction(Action<Map<String,Object>> action)` which is supposed to publish message to all nodes including the one issued in cluster with the message. If one of node receives a message, it should pass the message to `messageAction()` in `ClusteredServer`.

**Note**

* Most MOM in Java requires message to be serialized. In other words, `Action` instance used in `all`, `byId` and `byTag` (not `socketAction`) should implement `Serializable`. Whereas `Action` is generally used as anonymous class, but `Serializable` [can't be used in that manner](http://docs.oracle.com/javase/7/docs/platform/serialization/spec/serial-arch.html#4539). Therefore always use `Sentence` instead of `Action` especially in this case.
* If your MOM doesn't allow to publish and subscribe `Serializable` directly, you need to use an array of bytes through doing [serialization and deserialization](http://stackoverflow.com/questions/2836646/java-serializable-object-to-byte-array).

<div class="row">
<div class="large-6 columns">
{% capture panel %}
_Hermaphrodite case. It will work exactly like `DefaultServer`._

```java
final ClusteredServer server = new ClusteredServer();

server.publishAction(new Action<Map<String, Object>>() {
    @Override
    public void on(Map<String, Object> message) {
        server.messageAction().on(message);
    }
});
```
{% endcapture %}{{ panel | markdownify }}
</div>
<div class="large-6 columns">
{% capture panel %}
_Hazelcast case. You can regard `topic` as node in the above explanation._

```java
HazelcastInstance hazelcast = HazelcastInstanceFactory.newHazelcastInstance(new Config());
final ClusteredServer server = new ClusteredServer();
final ITopic<Map<String, Object>> topic = hazelcast.getTopic("vibe:app");

topic.addMessageListener(new MessageListener<Map<String, Object>>() {
    @Override
    public void onMessage(Message<Map<String, Object>> message) {
        server.messageAction().on(message.getMessageObject());
    }
});
server.publishAction(new Action<Map<String, Object>>() {
    @Override
    public void on(Map<String, Object> message) {
        topic.publish(message);
    }
});
```
{% endcapture %}{{ panel | markdownify }}
</div>
</div>