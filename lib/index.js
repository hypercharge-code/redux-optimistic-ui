'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.optimistic = exports.ensureState = exports.REVERT = exports.COMMIT = exports.BEGIN = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _arrayUtils = require('./array-utils');

var BEGIN = exports.BEGIN = '@@optimist/BEGIN';
var COMMIT = exports.COMMIT = '@@optimist/COMMIT';
var REVERT = exports.REVERT = '@@optimist/REVERT';

var isOptimistState = function isOptimistState(state) {
  return state && Object.keys(state).length === 3 && state.hasOwnProperty('beforeState') && state.hasOwnProperty('history') && state.hasOwnProperty('current');
};

var ensureState = exports.ensureState = function ensureState(state) {
  return isOptimistState(state) ? state.current : state;
};

var createState = function createState(state) {
  return {
    beforeState: undefined,
    history: [],
    current: state
  };
};

var applyCommit = function applyCommit(state, targetActionIndex, reducer) {
  var history = state.history;
  // If the action to commit is the first in the queue (most common scenario)

  if (targetActionIndex === 0) {
    var historyWithoutCommit = history.slice(1);
    var nextOptimisticIndex = (0, _arrayUtils.findIndex)(historyWithoutCommit, function (action) {
      return action.meta && action.meta.optimistic && !action.meta.optimistic.isNotOptimistic && action.meta.optimistic.id;
    });
    // If this is the only optimistic item in the queue, we're done!
    if (nextOptimisticIndex === -1) {
      return _extends({}, state, {
        history: [],
        beforeState: undefined
      });
    }
    // Create a new history starting with the next one
    var newHistory = historyWithoutCommit.slice(nextOptimisticIndex);
    // And run every action up until that next one to get the new beforeState
    var newBeforeState = history.reduce(function (mutState, action, index) {
      return index <= nextOptimisticIndex ? reducer(mutState, action) : mutState;
    }, state.beforeState);

    return _extends({}, state, {
      history: newHistory,
      beforeState: newBeforeState
    });
  } else {
    // If the committed action isn't the first in the queue, find out where it is
    var actionToCommit = history[targetActionIndex];
    // Make it a regular non-optimistic action
    var newAction = Object.assign({}, actionToCommit, {
      meta: Object.assign({}, actionToCommit.meta, { optimistic: null })
    });
    var _newHistory = state.history.slice();
    _newHistory.splice(targetActionIndex, 1, newAction);
    return _extends({}, state, {
      history: _newHistory
    });
  }
};

var applyRevert = function applyRevert(state, targetActionIndex, reducer) {
  var beforeState = state.beforeState,
      history = state.history;

  var newHistory = void 0;
  // If the action to revert is the first in the queue (most common scenario)
  if (targetActionIndex === 0) {
    var historyWithoutRevert = history.slice(1);
    var nextOptimisticIndex = (0, _arrayUtils.findIndex)(historyWithoutRevert, function (action) {
      return action.meta && action.meta.optimistic && !action.meta.optimistic.isNotOptimistic && action.meta.optimistic.id;
    });
    // If this is the only optimistic action in the queue, we're done!
    if (nextOptimisticIndex === -1) {
      return _extends({}, state, {
        history: [],
        current: historyWithoutRevert.reduce(function (s, action) {
          return reducer(s, action);
        }, beforeState),
        beforeState: undefined
      });
    }
    newHistory = historyWithoutRevert.slice(nextOptimisticIndex);
  } else {
    newHistory = history.slice();
    newHistory.splice(targetActionIndex, 1);
  }
  var newCurrent = newHistory.reduce(function (s, action) {
    return reducer(s, action);
  }, beforeState);
  return _extends({}, state, {
    history: newHistory,
    current: newCurrent,
    beforeState: beforeState
  });
};

var optimistic = exports.optimistic = function optimistic(reducer) {
  var rawConfig = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var config = Object.assign({
    maxHistory: 100
  }, rawConfig);

  return function (state, action) {
    if (state === undefined || !isOptimistState(state)) {
      state = createState(reducer(ensureState(state), {}));
    }
    var historySize = state.history.length;

    var _ref = action.meta && action.meta.optimistic || {},
        type = _ref.type,
        id = _ref.id;

    // a historySize means there is at least 1 outstanding fetch


    if (historySize) {
      if (type !== COMMIT && type !== REVERT) {
        if (historySize > config.maxHistory) {
          console.error('@@optimist: Possible memory leak detected.\n                  Verify all actions result in a commit or revert and\n                  don\'t use optimistic-UI for long-running server fetches');
        }
        // if it's a BEGIN but we already have a historySize, treat it like a non-opt
        return _extends({}, state, {
          history: state.history.concat([action]),
          current: reducer(state.current, action)
        });
      }

      var targetActionIndex = (0, _arrayUtils.findIndex)(state.history, function (action) {
        return action.meta && action.meta.optimistic && action.meta.optimistic.id === id;
      });
      if (targetActionIndex === -1) {
        throw new Error('@@optimist: Failed to ' + (type === COMMIT ? 'commit' : 'revert') + '. Transaction #' + id + ' does not exist!');
      }

      // for resolutions, add a flag so that we know it is not an optimistic action
      action.meta.optimistic.isNotOptimistic = true;

      // include the resolution in the history & current state
      var nextState = _extends({}, state, {
        history: state.history.concat([action]),
        current: reducer(state.current, action)
      });

      var applyFunc = type === COMMIT ? applyCommit : applyRevert;
      return applyFunc(nextState, targetActionIndex, reducer);
    }
    // create a beforeState since one doesn't already exist
    if (type === BEGIN) {
      return _extends({}, state, {
        history: state.history.concat([action]),
        current: reducer(state.current, action),
        beforeState: state.current
      });
    }

    // standard action escape
    return _extends({}, state, {
      current: reducer(state.current, action)
    });
  };
};