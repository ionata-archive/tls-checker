/**
 * TLSChecker v0.1.0
 *
 * Checks for TLS 1.2 or 1.1 client support by doing a remote request to a
 * third party server at: https://www.howsmyssl.com/a/check
 *
 * TLS 1.1 and 1.2 are supported, but disabled by default for
 *   Internet Explorer 8–10 for Windows 7 / Server 2008 R2
 *                     10 for Windows 8 / Server 2012
 *                     IE Mobile 10 for Windows Phone 8
 * It will require configuration changes as per the following guide:
 * http://www.bauer-power.net/2014/06/how-to-enabled-tls-11-and-tls-12-in.html
 *
 * TLS 1.1 and 1.2 not supported at all:
 *   Internet Explorer 6-8 for Windows Server 2003
 *                     7–9 for Windows Vista / Server 2008)
 *   Safari 6 for Mac OS X 10.8
 *
 * NOTES:
 *
 * The result is internally cached so consecutive checks will result in no
 * extra remote requests. Simultaneous initial checks will yield an error.
 *
 * If localStorage is supported by the client and available the result will
 * be cached.
 *
 * USAGE:
 *
 * ```
 * TLSChecker.check(function(error, isCompatible) {
 *   if (error) {
 *     alert('Error: [' + error.name + '] ' + error.message);
 *     return;
 *   }
 * 
 *   if (isCompatible) {
 *     alert('All good');
 *   } else {
 *     alert('Not good');
 *   }
 * });
 * ```
 *
 * TLSChecker.reCheck(callback) will null the internal error and initiate a
 * regular check.
 *
 * TLSChecker.isRunning will be true if a check is running, false otherwise.
 *
 * TLSChecker.setTTL(milliseconds) will set the localStorage time to live value.
 * It defaults to 3 days.
 *
 * You can set window.maybeTLSIncompatible variable within an IE Conditional
 * comment, to determine early.
 * ```
 * <!--[if lte IE 7]><script type="text/javascript">window.maybeTLSIncompatible=1;</script><![endif]-->
 * ```
 *
 * Author: Evo Stamatov <evo@ionata.com.au>
 *
 */
;(function(window, document, undefined) {
  var TLSCheckVersion = '0.1.0';

  if ('jQuery' in window) {
    // Use jQuery
    var getter = function(url, callback) {
      jQuery.get(url)
          .done(function(data) {
            callback(null, data);
          })
          .fail(function(jqXHR, textStatus, errorThrown) {
            var error = new Error(errorThrown);
            error.name = textStatus;
            callback(error);
          });
    };
  } else {
    // Fallback to script tag hack
    var getter = function(url, callback) {
      // taken from jQuery :)
      var id = 'tls-ajax-getter',
          head = document.head || document.documentElement,
          script = document.getElementById(id),
          didFireCallback = false;

      if (script) {
        head.removeChild(script);
      }

      script = document.createElement('script');

      var callbackname = 'tls'+(function(N){return Array(N+1).join((Math.random().toString(36)+'00000000000000000').slice(2,18)).slice(0,N);})(10);
      window[callbackname] = function(data) {
        didFireCallback = true;
        callback(null, data);
        window[callbackname] = null;
      };

      script.async = true;
      script.id = id;
      script.src = url + '?callback=' + callbackname;

      script.onload = script.onreadystatechange = function(_, isAbort) {
        if (isAbort || !script.readyState || /loaded|complete/.test(script.readyState)) {
          script.onload = script.onreadystatechange = null;

          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }

          script = null;

          if (! didFireCallback && ! isAbort) {
            var error = new Error('TLS server error');
            error.name = 'tls-server-error';
            callback(error);
          }
        }
      };

      script.onerror = function() {
        script.onload(undefined, true);
        var error = new Error('JSONP load error');
        error.name = 'jsonp-error';
        callback(error);
      };

      head.insertBefore(script, head.firstChild);
    };
  }

  var url = 'https://www.howsmyssl.com/a/check';
  var approvedTLSVersions = [
    'TLS 1.2',
    'TLS 1.1'
  ];
  var timeToLive = 259200000; // 3 days - for localStorage cache

  var isError = null,
      isCompatible = null,
      isRunning = false,
      doesSupportLocalStorage = null;

  if ('maybeTLSIncompatible' in window) {
    isCompatible = window.maybeTLSIncompatible ? false : null;
  }

  function checkLocalStorageSupport() {
    if (doesSupportLocalStorage !== null) {
      return doesSupportLocalStorage;
    }

    doesSupportLocalStorage = false;
    try {
      doesSupportLocalStorage = 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) { }

    return doesSupportLocalStorage;
  }

  function isTLSCompatible(TLSData, approvedTLSVersions) {
    if (! TLSData || ! TLSData.tls_version) {
      return false;
    }

    var compatible = false;
    for (var k in approvedTLSVersions) {
      if (approvedTLSVersions[k] == TLSData.tls_version) {
        compatible = true;
        break;
      }
    }

    return compatible;
  }

  // ## callback = func(error, bool)
  function TLSCheck(callback) {
    if (isError !== null) {
      setTimeout(function() { callback(isError); });
      return;
    }

    if (isCompatible === null && checkLocalStorageSupport()) {
        var stored = localStorage.getItem('isTLSCompatible');
        if (stored && stored.length === 14) {
           var then = parseInt(stored.substr(1), 10);
           var now = +(new Date());
           if (then + timeToLive > now) { // re-check in three days
             isCompatible = (stored.substr(0,1) === "y");
             var value = (isCompatible ? 'y' : 'n') + now;
             localStorage.setItem('isTLSCompatible', value);
           }
        }
    }

    if (isCompatible !== null) {
      setTimeout(function() { callback(isError, isCompatible); });
      return;
    }

    if (isRunning) {
      var error = new Error('Already running');
      error.name = 'already-running';
      setTimeout(function() { callback(error); });
      return;
    }

    isRunning = true;
    try {
      getter(url, function(error, TLSData) {
        isRunning = false;

        if (error) {
          isError = error;
        } else {
          isCompatible = isTLSCompatible(TLSData, approvedTLSVersions);

          if (checkLocalStorageSupport()) {
            var now = +(new Date());
            var value = (isCompatible ? 'y' : 'n') + now;
            localStorage.setItem('isTLSCompatible', value);
          }
        }

        setTimeout(function() { callback(isError, isCompatible); });
      });
    } catch (e) {
      setTimeout(function() {
        isRunning = false;
        var error = new Error('AJAX/Server error');
        error.name = 'ajax-server-error';
        callback(error);
      });
    }
  }

  function TLSReCheck(callback) {
    isError = isCompatible = null;
    TLSCheck(callback);
  }

  function TLSNoCompat() {
    if (typeof TLSChecker_ != "undefined") {
      window.TLSChecker = TLSChecker_;
      TLSChecker_ = undefined;
    }

    return TLSChecker;
  }

  var TLSChecker_ = window.TLSChecker,
      TLSChecker = {
        version:   TLSCheckVersion,
        check:     TLSCheck,
        reCheck:   TLSReCheck,
        noCompat:  TLSNoCompat,
        isRunning: function() { return isRunning; },
        setTTL:    function(ttl) { timeToLive = parseInt(ttl, 10); },
      };

  /* DEBUG ONLY
  TLSChecker.changeUrl = function(newUrl) {
    if (isRunning) {
      return false;
    }
    url = newUrl;
    isError = null;
    //isCompatible = null;
    return true;
  };
  /**/

  window.TLSChecker = TLSChecker;
})(window, document);

