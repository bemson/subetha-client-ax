/*!
 * SubEtha Ad Hoc-Exchange
 * http://github.com/bemson/subetha-client-ax/
 *
 * Copyright 2014, Bemi Faison
 * Released under the Apache License
 */
/* global define, require */
!function (inAMD, inCJS, RegExp, scope, undefined) {

  function initSubEthaAX() {

    var
      subetha = ((inCJS || inAMD) ? require('subetha') : scope.Subetha),
      guid = subetha.guid,
      Client = subetha.Client,
      Peer = subetha.Peer,
      chainPrefix = '=',
      protoSlice = Array.prototype.slice,
      protoHas = Object.prototype.hasOwnProperty,
      DISCONNECT_EVENT = '::disconnect',
      ENDEXCHANGE_EVENT = '::endExchange',
      EXCHANGE_EVENT = '::exchange'
    ;

    // Utility

    function objKeys(obj) {
      var
        ary = [],
        key;

      for (key in obj) {
        ary.push(key);
      }
      return ary;
    }

    // Functions

    function startExchange(client, args, pid) {
      var
        xid,
        phrase = args[0],
        peers,
        peersLn;

      if (!phrase || typeof phrase != 'string') {
        return false;
      }

      if (pid) {
        // converse with the given peer
        peers = [pid];
      } else {
        // converse with all peers
        peers = objKeys(client.peers);
      }
      peersLn = peers.length;

      if (!peersLn) {
        // exit if no peers
        return;
      }

      // create exchange identifier
      xid = guid();

      // exit if can't start convo
      if (!sendExchange( client, xid, pid, 0, phrase, args.length ? protoSlice.call(args, 1) : [] )) {
        return false;
      }

      // track exchange with each message to peer
      while (peersLn--) {
        setupExchange(client, xid, peers[peersLn]).push(phrase);
      }

      return xid;
    }

    function setupExchange(client, xid, pid) {
      var
        pids,
        result;

      // init client
      if (!protoHas.call(client, '_ax')) {
        result =
        client._ax =
          {
            // active exchanges
            xids: {},
            // exchange callbacks
            cbs: {}
          };
        // ensure all exchanges are properly closed when the client disconnects
        client.on(DISCONNECT_EVENT, destroyClient);
      }

      // add tracker for this exchange
      if (xid && !protoHas.call(client._ax.xids, xid)) {
        result =
        client._ax.xids[xid] =
          {
            pids: {},
            cnt: 0
          };
      }

      // start chain for the given peer - if any
      if (pid && !protoHas.call(client._ax.xids[xid].pids, pid)) {
        client._ax.xids[xid].cnt++;
        pids = [];
        // shared function to end this exchange
        pids.endFn = function () {
          return !!endExchange(client, xid, pid);
        };
        result =
        client._ax.xids[xid].pids[pid] =
          pids;
      }

      return result;
    }

    function sendExchange(client, xid, pid, idx, phrase, data) {
      return client._transmit('exchange',
        pid,
        {
          // identifier
          xid: xid,
          // starting index
          idx: idx,
          // first phrase
          phrase: phrase,
          // args
          data: data
        }
      );
    }


    function destroyClient() {
      var
        me = this,
        exchanges = me._ax.xids,
        xid;

      // remove listener
      me.off(DISCONNECT_EVENT, destroyClient);

      // end current exchanges
      for (xid in exchanges) {
        // tell self the exchange ended
        removePeerExchange(me, xid, exchanges[xid], 1);
      }

      // clean up
      delete me._ax;
    }

    function removePeerExchange(client, xid, pid) {
      var
        exchanges,
        exchange,
        peerExchange;

      if (!protoHas.call(client, '_ax')) {
        // exit if there is no exchange for this peer
        return;
      }

      // alias this exchange
      exchanges = client._ax.xids;
      exchange = exchanges[xid];

      // if there is no peerExchange
      if (
        !exchange ||
        !protoHas.call(exchange.pids, pid)
      ) {
        return;
      }

      // alias the exchange with this peer
      peerExchange = exchange.pids[pid];
      // delete peer exchange
      delete exchange.pids[pid];
      // remove entire exchange if this was the last peer
      if (!--exchange.cnt) {
        delete exchanges[xid];
      }
      // inform client that this exchange has ended
      fireEndExchangeEvent(client.peers[pid], peerExchange);
      return 1;
    }

    function fireEndExchangeEvent(peer, chain) {
      peer._client.fire(ENDEXCHANGE_EVENT, peer, chain.concat());
    }

    function endExchange(client, xid, pid) {
      killExchange(client, xid, pid);
      removePeerExchange(client, xid, pid);
    }

    function killExchange(client, xid, pid) {
      // end exchange with given peer(s)
      return client._transmit(
        'exchange',
        pid,
        {
          xid: xid,
          xkill: 1
        }
      );
    }

    // Classes

    // add callback for message chain
    Client.prototype.adhoc = function () {
      var
        me = this,
        args = arguments,
        cb = args[args.length - 1];

      if (
        args.length > 1 &&
        typeof cb == 'function'
      ) {
        setupExchange(me);
        me._ax.cbs[chainPrefix + protoSlice.call(args, 0, -1).join()] = cb;
      }

      return me;
    };

    // remove callback for message chain
    Client.prototype.unhoc = function () {
      var
        me = this,
        args,
        chain,
        cbs,
        cbKey;

      if (protoHas.call(me, '_ax')) {

        args = protoSlice.call(arguments);

        if (typeof args[args.length - 1] == 'function') {
          // remove last arg when it's a function
          args = args.slice(0, -1);
        }

        // get target key
        chain = chainPrefix + args.join();
        chainRxp = new RegExp('^' + chain);
        // alias callbacks
        cbs = me._ax.cbs;

        // prune all chains prefixed with this regexp
        for (cbKey in cbs) {
          if (chainRxp.test(cbKey)) {
            delete cbs[cbKey];
          }
        }
      }

      return me;
    };

    Client.prototype.ask = function () {
      return startExchange(this, arguments);
    };

    Peer.prototype.ask = function () {
      var me = this;

      return startExchange(me._client, arguments, me.id);
    };

    // end all exchanges that began with the given phrase or have the given id
    Peer.prototype.endExchange = function (xref) {
      var
        me = this,
        peerId = me.id,
        client = me._client,
        exchanges = me._ax,
        cnt = 0,
        endAll = !xref,
        isId,
        xid;

      if (exchanges) {
        for (xid in exchanges) {
          isId = xid == xref;
          if (
            endAll ||
            // matched the exchange id
            isId ||
            // matches the first msg in this exchange
            exchanges[xid].chain[0] == xref
          ) {
            endExchange(client, peerId, xid);
            cnt++;
            if (isId) {
              break;
            }
          }
        }
      }

      return cnt;
    };

    Subetha.msgType.exchange = function (client, peer, customEvent, payload) {
      var
        data = payload.msg.data,
        xid = data.xid,
        pid = peer.id,
        midx,
        exchanges,
        peerExchange,
        phrase,
        chain;

      // exit when no exchanges are registered - i.e., this client can't host a conversation
      if (!protoHas.call(client, '_ax')) {
        endExchange(client, xid, pid);
        return;
      }

      // exit when told to end exchange
      if (protoHas.call(data, 'xkill')) {
        // discard tracker for exchange with this peer
        removePeerExchange(client, xid, pid);
        return;
      }


      setupExchange(client, xid, pid);
      exchanges = client._ax;
      phrase = data.phrase;
      midx = data.idx;
      peerExchange = exchanges.xids[xid].pids[pid];
      chain = chainPrefix + peerExchange.concat(phrase).join();

      // end convo when...
      if (
        // there is no callback for this chain, or...
        !protoHas.call(exchanges.cbs, chain) ||
        // the index is invalid
        peerExchange.length != midx
      ) {
        endExchange(client, xid, pid);
        return;
      }

      // add phrase to peer exchange
      peerExchange.push(phrase);

      customEvent.phrase = phrase;
      customEvent.data = data.data;
      // add exchange id
      customEvent.xid = xid;
      // allow ending this conversation at anytime
      customEvent.end = peerExchange.endFn;
      // allow replying once to this exchange
      customEvent.reply = function () {
        var
          args,
          phrase;

        if (protoHas.call(exchanges.xids, xid) && peerExchange.length == midx + 1) {
          args = arguments;
          phrase = args[0];
          // add reply to this conversation
          peerExchange.push(phrase);
          // send reply to peer
          return sendExchange(client, xid, pid, midx + 1, phrase, protoSlice.call(args, 1));
        }
        return false;
      };
      // expose chain
      customEvent.thread = peerExchange.concat();

      // acknowledge exchange event
      client.fire(EXCHANGE_EVENT, customEvent, client.peers[pid]);

      // if the callback is still here...
      if (protoHas.call(exchanges.cbs, chain)) {
        // get exchange callback
        cb = exchanges.cbs[chain];

        if (data.data.length) {
          cb.apply(client, [customEvent].concat(data.data));
        } else {
          cb.call(client, customEvent);
        }
      } else {
        // die without a callback
        endExchange(client, xid, pid);
      }

    };

    return subetha;
  }

  // initialize and expose module, based on the environment
  if (inAMD) {
    define(initSubEthaAX);
  } else if (inCJS) {
    module.exports = initSubEthaAX();
  } else if (scope.Subetha) {
    // manipulate existing namespace
    initSubEthaAX();
  }
}(
  typeof define === 'function',
  typeof exports != 'undefined',
  RegExp, this
);