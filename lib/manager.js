'use strict';

/*
 * @note In previous versions, the WatcherManager class file was being treated
 *       and exported as a static instance. For separation of concerns, we've
 *       relegated the actual class to it's own file and have created this file
 *       to act as the static instance.
 */
const WatcherManager = require('./WatcherManager');

module.exports = new WatcherManager();
