# SubEtha Ad Hoc-Exchange

Define informal protocols with SubEtha messages

version 0.0.0-alpha
by Bemi Faison

## Description

SubEtha Ad Hoc-Exchange (AX) is a Subetha-Client plugin that enables binding to a _sequence_ of phrases between peers. When defined incrementally, these bindings represent an informal communications protocol, to ensure the stateful execution of your logic. This plugin is bundled with the SubEtha module.

**Note:** Please see the [Subetha project page](https://github.com/bemson/subetha), for important background information, plus development, implementation, and security considerations.

## Usage

AX provides methods to setup, start, teardown, and end an exchange. Keep in mind that peers must _agree_ on a given protocol in order to have a conversation.

### Setup an exchange

Use the `#adhoc()` method to bind one callback to a sequence of events (or "phrases"). This is similar to the `Client#on()` method, except you're listening for a specific number and order of event types (or "phrases"). Exchange callbacks receive an _exchange-event object_ to track, progress or end the conversation.

```js
var cookbook = new Subetha.Client().open('recipes@public');

cookbook.adhoc('got recipes?', function (convo) {
  console.log('Peer #%s asked: "%s"', convo.peer.id, convo.phrase);
  console.log('This is message number %d in this thread', convo.thread.length);
  convo.reply('food group?');
});
```

**Note:** Exchange events will not collide with events subscribed to via `Client#on()`.

The last phrase, preceding the callback, is what your logic is responding _to_ - similar to the `Client#on()` method. Any preceding strings represent the _history_ of events that must occur in order to handle the exchange event. That is, what you sent before what they sent, and so on, in reverse, alternating order. (AX keeps track of each peer exchange.)

```js
cookbook
  .adhoc('got recipes?', 'food group?', 'fruit', sendRecipe)
  .adhoc('got recipes?', 'food group?', 'vegetable', sendRecipe)
  .adhoc('got recipes?', 'food group?', 'protein', sendRecipe)
  .adhoc('got recipes?', 'food group?', 'grain', sendRecipe)
  .adhoc('got recipes?', 'food group?', 'dairy', sendRecipe);

function sendRecipe(convo) {
  convo.reply('cook', 'some', convo.phrase, 'recipe');
}
```

**Note:** As a rule of thumb, callbacks that follow an odd number of phrases must be initiated by a peer. Callbacks following an even number of events must be initiated by the client.

### Starting an exchange

Use the `#ask()` method to begin an exchange. This method is available on both client and peer instances. Invoking it on the client starts an exchange with every channel peer.

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

**Note:** If the peer has no callback ready for an incoming exchange, it's ended automatically.

#### Responding to an exchange

The exchange-event object respresents a suspended conversation. It features a closured `#reply()` method to forward the conversation, _responding_ to the last phrase. The signature for this method is similar to that of `Client#fire()`: an arbitrary string (i.e., the phrase) and any number of optional arguments.

You can only reply once per exchange event. Once done the exchange-object and all it's methods will not impact the conversation. (The one exception is the `#end()` method.) For instance, the first call to `#reply()` returns `true`, while subsequents calls return `false`.

### Tearing down an exchange

Use the `#unhoc` method to remove callbacks to an exchange. Callbacks bound to sequences beyond the one you target, will also be removed, since they would no longer be reached in a conversation.

Below removes all callbacks for the entire "get recipes?" exchange, from the `chef` instance in the previous section.

```js
chef.unhoc('got recipes?');
```

**Note:** To alter an exchange, simply assign a new callback to an existing exchange sequence. This _replaces_ the callback while preserving the sequence, and any that were added to it. In other words, do _not_ use `#unhoc` to remove callbacks you intend to replace.

### Ending an exchange

Conversations automatically persist between peers, until the last phrase (sent or received) reaches the end of a client's registered sequence callbacks.

You may also end an exchange manually, with the `#end()` method of any exchange-event object. Below demonstrates manually ending a conversation that turns silly.

```js
cookbook.adhoc('got recipes?', 'food group?', 'green eggs and ham', function (convo) {
  convo.end();
});
```

#### Knowing when to end an exchange

Under the hood, this plugin tracks each exchange, no matter it's length or duration; Lengthy exchanges are generally unnecessary. You should use small, two or three round exchanges, then add some state to the given peer. Below demonstrates an exchange that "approves" a peer, such that other events can use that flag in their logic.

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

Below is reference documentation for the SubEtha Ad Hoc-Exchange module - i.e., additions to [SubEtha-Client module](https://github.com/bemson/subetha).

**Note:** Instance methods are prefixed with a pound-symbol (`#`). Instance properties are prefixed with an at-symbol (`@`). Static members are prefixed with a double-colon (`::`).

### Subetha::Client

##### Exchange event object

Exchange callbacks receive a _peer-event object_, along with any additonal parameters, sent by the peer.

  * `end()` - Ends this conversation with this peer.
  * `reply()` - Responds to this conversation with this peer.
  * `thread` - A static array of phrases in the "conversation", thus far.
  * `data` - An array of any additional arguments passed from the `#ask()` method.
  * `id` - Unique identifier for this exchange event.
  * `peer` - The peer that sent this phrase.
  * `sent`:  The time (as a Date instance) when the message was sent.
  * `timeStamp`: The time (in milliseconds) when the event occurred.
  * `phrase` - The last string passed via `#ask()` or `#reply()`.
  * `xid` - Unique identifier of this exchange, as returned by `#ask()`.

An odd number of phrases in the `thread` property, means the exchange was started by the peer. Otherwise, it was started by the client. The zeroeth index represents the first phrase sent.

#### Client#adhoc()

Subscribe to a sequence of phrases exchanged with a peer.

```
client.adhoc(phrase*, callback);
```

  * **phrase**: _(string)_ One or more phrases, alternating between client and peer - the last one having come from the peer.
  * **callback**: _(function)_ A callback to invoke when the sequence of  (sent and received) phrases are met.

Only _one_ callback is allowed per event sequence. Reapplying a new callback to an existing sequence, replaces the last one assigned.

Returns the client instance.

#### Client#ask()

Begin an exchange with each peer.

```
client.ask(phrase [, args*]);
```

  * **phrase**: _(string)_ The first phrase in the exchange.
  * **args**: _(mix)_ Remaining arguments that should be passed to all attached callbacks.

Returns a unique identifier for this exchange. (The identifier may be used to end this exchange with a peer, via `Peer#endExchange()`.)

#### Client#unhoc()

Unsubscribe from a sequence of phrases.

```
client.unhoc(phrase*);
```

  * **phrase**: _(string)_ One or more phrases, alternating between client and peer - the last one having come from the peer.

**Note:** Sequences that come _after_ the given sequence are also removed, since they would no longer be reached in an exchange. To _replace_ a callback for a sequence, call `#adhoc()` with the sequence and the replacement callback.

Returns the client instance.

### Subetha::Peer

#### Peer#ask()

Begin an exchange with this peer.

```
peer.ask(phrase [, args*]);
```

  * **phrase`**: _(string)_ The first message in this exchange.
  * **args**: _(mix)_ Remaining arguments that should be passed to all attached callbacks.

Returns a unique identifier for this exchange. (The identifier may be used to end this exchange with a peer, via `Peer#endExchange()`.)

#### Peer#endExchange()

End one or more exchanges with this peer.

```
peer.endExchange([ref]);
```

  * **ref**: _(string)_ The exchange id, or initial phrase of the conversation to end. When omitted, all exchanges will be ended.

Returns the number of exchanges ended.

## Installation

SubEtha Ad Hoc-Exchange works within, and is intended for, modern JavaScript browsers. It is available on [bower](http://bower.io/search/?q=subetha-client-ax), [component](http://component.github.io/) and [npm](https://www.npmjs.org/package/subetha-client-ax) as a [CommonJS](http://wiki.commonjs.org/wiki/CommonJS) or [AMD](http://wiki.commonjs.org/wiki/Modules/AsynchronousDefinition) module.

If SubEtha Ad Hoc-Exchange isn't compatible with your favorite runtime, please file an issue or pull-request (preferred).

### Dependencies

SubEtha AX depends on the following modules:

  * [SubEtha-Client](https://github.com/bemson/subetha-client)

### Web Browsers

Use a `<SCRIPT>` tag to load the _subetha-client-ax.min.js_ file in your web page. The file does _not_ include the SubEtha-Client module. You must include this as well, _before_ loading this plugin, which updates members of the `Subetha` namespace, in the global scope.

```html
  <script type="text/javascript" src="path/to/subetha-client.min.js"></script>
  <script type="text/javascript" src="path/to/subetha-client-ax.min.js"></script>
  <script type="text/javascript">
    // ... SubEtha dependent code ...
  </script>
```

**Note:** The minified file was compressed by [Closure Compiler](http://closure-compiler.appspot.com/).

Generally speaking, the standalone version of this plugin should not be installed manually, since it's bundled with the SubEtha module. Install the [SubEtha module](https://github.com/bemson/subetha) instead - a rollup of the SubEtha-Client and recommended plugins.

### Package Managers

  * `npm install subetha-client-ax`
  * `component install bemson/subetha-client-ax`
  * `bower install subetha-client-ax`

**Note:** The npm package uses `subetha-client` as a [peerDependency](https://www.npmjs.org/doc/files/package.json.html#peerdependencies).

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