# SubEtha Ad Hoc-Exchange

Define informal protocols with SubEtha messages

version 0.0.0-alpha
by Bemi Faison

## Description

SubEtha Ad Hoc-Exchange (AX) is a Subetha-Client plugin that enables binding to a _sequence_ of events between peers. When defined incrementally, these bindings represent an informal communications protocol, to ensure the stateful execution of your logic. (The AX plugin is bundled with the SubEtha module.)

**Note:** Please see the [Subetha (Client) project page](https://github.com/bemson/subetha), for important background information, plus development, implementation, and security considerations.

## Usage

AX provides methods to setup, start, teardown, and end an exchange. Keep in mind that peers must _agree_ on a given protocol in order to have a conversation.

### Setup an exchange

Use the `#adhoc()` method to bind one callback to a sequence of events. The "sequence" is one or more events, listed method arguments. Exchange callbacks receive an _exchange-event object_, which extends the normal SubEtha event-object with exchange-oriented members and methods.

```js
var cookbook = new Subetha.Client().open('recipes@public');

cookbook.adhoc('got recipes?', function (convo) {
  console.log('Peer #%s asked: "%s"', convo.peer.id, convo.type);
  console.log('This is message number %d in this thread', convo.thread.length);
  convo.reply('food group?');
});
```

**Note:** Exchange events will not collide with normal events or event subscribers - i.e., those consumed by `Client#on()`, or created by the methods `Client#emit()` and `Peer#send()`.

The string preceding the callback, is what your callback is responding to - similar to the `#on()` method. Any remaining strings reflect the _history_ of events that must occur _before_ responding to the peer event. That is, what you sent before what they sent, and so on, in reverse, alternating order. (AX keeps track of each peer exchange.)

```js
cookbook
  .adhoc('got recipes?', 'food group?', 'fruit', sendRecipe)
  .adhoc('got recipes?', 'food group?', 'vegetable', sendRecipe)
  .adhoc('got recipes?', 'food group?', 'protein', sendRecipe)
  .adhoc('got recipes?', 'food group?', 'grain', sendRecipe)
  .adhoc('got recipes?', 'food group?', 'dairy', sendRecipe);

function sendRecipe(convo) {
  convo.reply('cook', 'some', convo.type, 'recipe');
}
```

**Note:** As a rule of thumb, callbacks that follow an odd number of events must be initiated by a peer. Callbacks following an even number of events must be initiated by the client.

### Start an exchange

Use the `#ask()` method to begin an exchange. This method is available on client and peer instances. Invoking this method on the client will start exchanges with _every_ peer in your channel.

```js
var chef = new Subetha.Client().open('recipes@public');

// setup exchange callbacks
chef
  .adhoc('got recipes?', 'food group?', function () {
    convo.reply('fruit');
  })
  .adhoc('got recipes?', 'food group?', 'fruit', 'cook', function (convo, more, args, sent) {
    console.log('Received: %s %s %s!', more, args, sent);
  });

// begin exchange with all peers in "recipes" channel
chef.ask('got recipes?');
```

**Note:** You **must** setup callbacks _before_ starting an exchange, or it will end prematurely.

#### Respond during an exchange

For each exchange-event object, a closured `#reply()` method exists to forward _that_ moment in the conversation. The signature is the same as `Client#emit()` or `Peer#send()`: an event name and optional arguments.

Invoking `#reply()` completes your round in the back and forth communication with a peer. You can only reply once per exchange event. The first call will return `true`, and subsequents calls return `false`. If the exchange is somehow ended - for example, due to the peer disconnecting - the method will also return `false`.

### Teardown an exchange

Use the `#unhoc` method to remove callbacks bound to an exchange thread. Callbacks scheduled after the targeted thread are also removed (since they would no longer be reached in a conversation). Below removes all callbacks for the entire "get recipes?" exchange, on the `chef` instance in the previous section.

```js
chef.unhoc('got recipes?');
```

**Note:** Do not use `#unhoc` to remove callbacks you intend to replace - the method is intentially destructive. To _swap_ callbacks, simply override the thread using `#adhoc()` again. Only one callback can be bound to an exchange (the existing callback will be discarded).

### End an exchange

Conversations automatically persist between peers, until the last event (sent or received) reaches the end of a client's predefined callbacks. However, you can manually end an exchange, by invoking the exchange-event object's `#end()` method.

```js
cookbook.adhoc('got recipes?', 'food group?', 'green eggs and ham', function (convo) {
  convo.end();
});
```

#### When to end an exchange

Lengthy exchanges are generally unnecessary. Instead, you should use small, two or three round exchanges, then add some state to the given peer. Below demonstrates an exchange that "approves" a peer, such that regular events can use this flag in their logic.

```js
var trusty = new Subetha.Client().open('wild-west@public');

// set up two round exchange to flag peers
trusty
  .adhoc('yo yo!', function (convo) {
    convo.reply('who is it?!');
  })
  .adhoc('yo yo!', 'who is it?!', 'me fool!', function (convo, someAuthToken) {
    if (isTokenValid(someAuthToken)) {
      // let the peer know they are now trusted
      convo.reply('wassup!?');
      // capture result of exchange in peer
      convo.peer.trusted = true;
    } else {
      convo.end();
    }
  });

// only respond to "trusted" peers
trusty.on('gimme data', function (evt) {
  if (evt.peer.trusted) {
    evt.peer.send('data', getPriviledgedData());
  }
});
```

## API

Below is reference documentation for the SubEtha Ad Hoc-Exchange module - i.e., additions to [SubEtha (Client) module](https://github.com/bemson/subetha).

**Note:** Instance methods are prefixed with a pound-symbol (`#`). Instance properties are prefixed with an at-symbol (`@`). Static members are prefixed with a double-colon (`::`).

### Subetha::Client

##### Client exchange object

Exchange callbacks receive an _exchange object_ which adds to the client event object used with event callbacks. Below are additional members from this module.

  * `#reply()` - Responds to this thread with this peer; uses the same syntax as `#send()`.
  * `#end()` - Prevents further receipt or response of messages.
  * `@thread` - An array of phrases capturing the "conversation". An odd number of phrases means the exchange was started by the peer. Otherwise, it was started by the client.

#### Client#adhoc()

Subscribe to a sequence of events communicated with a peer.

```
client.adhoc(type*, callback);
```

  * **type**: _(string)_ One or more events, alternating between client and peer - the last is from a peer.
  * **callback**: _(function)_ A callback to invoke when the sequence of types sent and received are met.

Only one callback is allowed per event sequence.

#### Client#ask()

Begin an exchange with each peer.

```
client.ask(type [, args]);
```

  * **type**: _(string)_ The first event in the exchange.
  * **args**: _(mix)_ Remaining arguments that should be passed to all attached callbacks.

#### Client#unhoc()

Unsubscribe from a sequence of events.

```
client.unhoc(type, ...);
```

  * **type**: _(string)_ One or more events, alternating between client and peer - the last is from a peer.

**Note:** Sequences that depend on the removed sequence will also be removed.


### Subetha::Peer

#### Peer#ask()

Begin an exchange with this peer.

```
peer.ask(type [, args]);
```

  * **type**: _(string)_ The first event in the exchange.
  * **args**: _(mix)_ Remaining arguments that should be passed to all attached callbacks.

#### Peer#endExchange()

End one or more exchanges with this peer.

```
peer.endExchange([ref]);
```

* **ref**: _(string)_ The exchange id or starting type to end. When omitted, all exchanges will end.

Returns `true` when one or more exchanges are ended. Otherwise, `false`.

## Installation

SubEtha AX works within, and is intended for, modern JavaScript browsers. It is available on [bower](http://bower.io/search/?q=subetha-client-ax), [component](http://component.github.io/) and [npm](https://www.npmjs.org/package/subetha-client-ax) as a [CommonJS](http://wiki.commonjs.org/wiki/CommonJS) or [AMD](http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition) module.

If SubEtha Ad Hoc-Exchange isn't compatible with your favorite runtime, please file an issue or pull-request (preferred).

### Dependencies

SubEtha AX depends on the following modules:

  * [SubEtha](https://github.com/bemson/subetha)

### Web Browsers

Use a `<SCRIPT>` tag to load the _subetha-client-ax.min.js_ file in your web page. The file does _not_ include the SubEtha-Client module. You must include this as well, _before_ loading this plugin, which updates members of the `Subetha` namespace, in the global scope.

```html
  <script type="text/javascript" src="path/to/subetha.min.js"></script>
  <script type="text/javascript" src="path/to/subetha-client-ax.min.js"></script>
  <script type="text/javascript">
    // ... SubEtha dependent code ...
  </script>
```

**Note:** The minified file was compressed by [Closure Compiler](http://closure-compiler.appspot.com/).

Generally speaking, the standalone version of this plugin should not be installed manually, since it's bundled with the SubEtha-Client module.

### Package Managers

  * `npm install subetha-client-ax`
  * `component install bemson/subetha-client-ax`
  * `bower install subetha-client-ax`

### AMD

Assuming you have a [require.js](http://requirejs.org/) compatible loader, configure an alias for the SubEtha Ad Hoc-Exchange module (the term "subetha-client-ax" is recommended, for consistency). The _subetha-client-ax_ module exports a module namespace.

```js
require.config({
  paths: {
    'subetha-client-ax': 'libs/subetha-client-ax'
  }
});
```

Then require and use the module in your application code:

```js
require(['subetha-client-ax'], function (Subetha) {
  // ... SubEtha dependent code ...
});
```

**Caution:** You should not load the minified file via AMD. Instead use AMD optimizers like [r.js](https://github.com/jrburke/r.js/), in order to roll-up your dependency tree.

## License

SubEtha Ad Hoc-Exchange is available under the terms of the [Apache-License](http://www.apache.org/licenses/LICENSE-2.0.html).

Copyright 2014, Bemi Faison