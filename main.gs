// App Settings
var app = {
  github: 'https://raw.githubusercontent.com/ChristopherKlay/ClaimCatcher/refs/heads/main/',
  prodPage: 'https://isthereanydeal.com/apps/2166/',
  storage: PropertiesService.getScriptProperties(),
  debug: false,
  debugChannel: 'Debug'
}

// Webhook Setup
var webhooks = {
    "Debug": {
        path: 'https://discord.com/api/webhooks/1180589390494449824/QVNqztzVnGeJbfNEf90krqyClle-WIjT_eywPr5JqAqbE47EmH5zaYBtHVI0akCqNVdx',
        thread: false,
        enable: app.debug,
        ping: '@everyone'
    },
    "TheButler": {
        path: 'https://discord.com/api/webhooks/1281209277499052042/f0Ppla1T7X3yovVaj61m7t9_d_TuH1DSSmCzhfveQ3pNSlZu6qMuDpCS27qKW26OwQe-',
        thread: false,
        enable: true,
        ping: '<@&1284064239685734410>'
    },
    "InclusiveNerding": {
        path: 'https://discord.com/api/webhooks/1192031142073864192/AcZaRoPtJFpZhxas7PRDsEeEDOIXGeYJSr5Fk7bMLUXCC1xYZCNCoEB809nXKT-lUwNO',
        thread: false,
        enable: true,
        ping: '<@&1192022314926215238>'
    },
    "Cloudplay": {
        path: 'https://discord.com/api/webhooks/1281191033425629184/I7f-q8SOYhR0vmwpzzHFSGoxp3jkftk4KPxNpOJI7a__bR3sBZ4cqR6f8TZg0HMmozvo',
        thread: false,
        enable: true,
        ping: '<@&1285903771129610240>'
    },
    "Proffer": {
        path: 'https://discord.com/api/webhooks/1208206319169835019/M5U9PIfE6Uy-Nfz8k7q_xkFOJmgDIZG-vM_jsAw3aSChVxCPch7myxvQb76WrJEaId3S',
        thread: false,
        enable: true,
        ping: false
    }
}

function getGiveaways() {
  var url = 'https://isthereanydeal.com/feeds/US/giveaways.rss'
  var xml = UrlFetchApp.fetch(url).getContentText()
  var document = XmlService.parse(xml)
  var root = document.getRootElement()
  var channel = root.getChild('channel')

  // Get all giveaways & details
  var items = channel.getChildren('item').reverse()
  items.forEach(item => {
    var entry = {}

    // Title
    entry.title = item.getChildText('description').split('/info/">')[1].split('<')[0]

    // Links
    entry.directLink = item.getChildText('description').split('a href=')[2].split('>')[0]
    entry.giveawayLink = item.getChildText('link')

    // Expire Date
    if (item.getChildText("description").includes('expires on')) {
      entry.expireDate = convertToUnixTime(item.getChildText("description").split('expires on ')[1].split('\n')[0])

      // Skip if expired
      var currentUnix = Math.floor(Date.now() / 1000)
      if (currentUnix > entry.expireDate) {
        return
      }

      entry.expireDate = '<t:' + entry.expireDate + ':R>'
    } else {
      entry.expireDate = 'Unknown'
    }

    // Giveaway ID
    entry.giveaway = item.getChildText('link').split('/')[4]

    // Check if new entry
    var giveaways = app.storage.getProperty('lastGiveaways') || []
    if (giveaways.includes(entry.giveaway)) {
      return
    } else {
      if (giveaways.length > 1) {
        giveaways = giveaways.split(',')
      }
      giveaways.unshift(entry.giveaway)
      giveaways = giveaways.slice(0,100)
      app.storage.setProperty('lastGiveaways', giveaways.toString())
    }

    // Store Settings
    entry.storeFront = item.getChildText("title").split(' on ')[item.getChildText("title").split(' on ').length - 1]
    
    switch(entry.storeFront) {
      case 'Steam':
        entry.storeLogo = app.github + 'media/storeIcons/steam.png'
        entry.storeColor = '746905'
        break
      case 'GOG':
        entry.storeLogo = app.github + 'media/storeIcons/gog.png'
        entry.storeColor = '16579836'
        break
      case 'Amazon':
        entry.storeLogo = app.github + 'media/storeIcons/prime.png'
        entry.storeColor = '9324799'
        break
      case 'Epic Game Store':
        entry.storeLogo = app.github + 'media/storeIcons/epic.png'
        entry.storeColor = '2828586'
        break
      case 'IndieGala Store':
        entry.storeLogo = app.github + 'media/storeIcons/indiegala.png'
        entry.storeColor = '15475239'
        break
      case 'Microsoft Store':
        entry.storeLogo = app.github + 'media/storeIcons/microsoft.png'
        entry.storeColor = '1071516'
        break
      case 'Fanatical':
        entry.storeLogo = app.github + 'media/storeIcons/fanatical.png'
        entry.storeColor = '16750592'
        break
      default:
        entry.storeLogo = app.github + 'media/storeIcons/default.png'
        entry.storeColor = '6710886'
        sendToDebug('store', entry)
    }

    // IsThereAnyDeal - Name to UUID
    var options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify([entry.title].flat())
    }

    // Request ID from IsThereAnyDeal
    var fullUrl = 'https://api.isthereanydeal.com/lookup/id/title/v1?key=' + encodeURIComponent(app.storage.getProperty('keyITAD'))
    var response = UrlFetchApp.fetch(fullUrl, options)
    var json = response.getContentText()
    var data = JSON.parse(json)

    // Store ID
    entry.id = Object.values(data)[0]

    // Deliver Webhooks
    for (endpoint in webhooks) {
      // Debug Blocker
      if (app.debug && endpoint != app.debugChannel || !webhooks[endpoint].enable) {
        continue
      }

      // Request settings
      var options = {
        method: 'POST',
        contentType: 'application/json',
        muteHttpExceptions: true
      }

      // Webhook
      var webhook = {
        "content": null,
        "embeds": [],
        "username": 'Claim Catcher',
        "avatar_url": app.github + 'media/embedProfile/avatar.png',
        "attachments": []
      }

      // Ping settings
      if (webhooks[endpoint].ping) {
        webhook.content = webhooks[endpoint].ping
      }

      // Embeds
      var embed = {
        'color': entry.storeColor,
        'fields': [
          {
            'name': 'Title',
            'value': convertXMLDecoding(entry.title)
          },
          {
            'name': 'Source',
            'value': '[Claim via ' + entry.storeFront + '](' + entry.directLink + ')',
            'inline': true
          },
          {
            'name': 'Free until',
            'value': entry.expireDate,
            'inline': true
          }
        ],
        'author': {
        'name': 'IsThereAnyDeal',
        'url': entry.giveawayLink,
        'icon_url': app.github + 'media/embedProfile/itad.png'
      },
        'image': {
          "url": 'https://assets.isthereanydeal.com/' + entry.id + '/banner600.jpg'
        },
        'thumbnail': {
          'url': entry.storeLogo
        }
      }
      webhook.embeds.push(embed)
      options.payload = JSON.stringify(webhook)

      // POST to Webhook
      UrlFetchApp.fetch(webhooks[endpoint].path, options)
    }
  })
}

function sendToDebug(type, obj=null) {
  // Message types
  switch(type) {
    case 'store':
      var title = 'New Store Found'
      var content = JSON.stringify(obj, null, ' ')
      break
    default:
      var title = 'Error'
      var content = 'Unknown debug type'
  }

  // Webhook
  var webhook = {
    "content": "<@155424883742867457>",
    "embeds": [
      {
        "color": 15709546,
        "fields": [
          {
            "name": title,
            "value": content
          }
        ]
      }
    ],
    "username": 'Claim Catcher',
    "avatar_url": app.github + 'media/embedProfile/avatar.png',
    "attachments": []
  }

  var options = {
    method: 'POST',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(webhook)
  }

  // POST to Webhook
  UrlFetchApp.fetch(webhooks['Debug'].path, options)
}

function convertToUnixTime(timestampString) {
  const date = new Date(timestampString);
  const unixTime = Math.floor(date.getTime() / 1000);
  return unixTime;
}

function convertXMLDecoding(xml) {
  xml = xml
  .replaceAll('&#039;', "'")
  .replaceAll('&amp;', '&')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"')
  .replaceAll('&#196;', 'Ä')
  .replaceAll('&#214;', 'Ö')
  .replaceAll('&#220;', 'Ü')
  .replaceAll('&#228;', 'ä')
  .replaceAll('&#246;', 'ö')
  .replaceAll('&#252;', 'ü')
  .replaceAll('&#223;', 'ß')
  return xml
}