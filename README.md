# TLSChecker v0.1.0 #

Checks for TLS 1.2 or 1.1 client support by doing a remote request to a
third party server at: https://www.howsmyssl.com/a/check

```
TLS 1.1 and 1.2 are supported, but disabled by default for
  Internet Explorer 8–10 for Windows 7 / Server 2008 R2
                    10 for Windows 8 / Server 2012
                    IE Mobile 10 for Windows Phone 8
```

It will require configuration changes as per the following guide:
http://www.bauer-power.net/2014/06/how-to-enabled-tls-11-and-tls-12-in.html

```
TLS 1.1 and 1.2 not supported at all:
  Internet Explorer 6-8 for Windows Server 2003
                    7–9 for Windows Vista / Server 2008)
  Safari 6 for Mac OS X 10.8
```

## Notes

The result is internally cached so consecutive checks will result in no
extra remote requests. Simultaneous initial checks will yield an error.

If `localStorage` is supported by the client and available the result will
be cached.

## Usage

```
TLSChecker.check(function(error, isCompatible) {
  if (error) {
    alert('Error: [' + error.name + '] ' + error.message);
    return;
  }

  if (isCompatible) {
    alert('All good');
  } else {
    alert('Not good');
  }
});
```

`TLSChecker.reCheck(callback)` will null the internal error and initiate a
regular check.

`TLSChecker.isRunning` will be true if a check is running, false otherwise.

`TLSChecker.setTTL(milliseconds)` will set the localStorage time to live value.
It defaults to 3 days.

You can set `window.maybeTLSIncompatible` variable within an IE Conditional
comment, to determine early.
```
<!--[if lte IE 7]><script type="text/javascript">window.maybeTLSIncompatible=1;</script><![endif]-->
```

## Dependencies

None.

If [jQuery](http://jquery.com) is available it will be used for the remote request.