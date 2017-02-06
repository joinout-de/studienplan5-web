/*
 * (C) 2016 Christoph "criztovyl" Schulz
 * GPLv3 and later.
 * Part of studienplan5, a util to convert HTMLed-XLS Studienplände into iCal files.
 * https://github.com/criztovyl/studienplan5
 */

// Setup Logger
Logger.useDefaults();

// Data w/ JS classes instead of JSON objects.
// 0 - keys, Clazz
// 1 - values, Clazz-es, key's parents
// 2 - events, key's events
var classes,
    // directory ical files are located in
    ical_dir,
    // whether ical files contain elements of all parents
    unified,
    // events list from data.json
    events,
    // classes as a hashmap
    classesTable,
    // Whether we need to check for Clazz#full_name is set (for <select> opts)
    checkForFull,
    // holds the FullCalendar element
    calendar,
    // prevent endless loops when we change the location hash ourselves
    noHashChange = 0,
    // logger
    logger = Logger.get("studienplan5-web");

function Clazz(name, course, cert, jahrgang, group){
    this.name = name;
    this.course = course;
    this.cert = cert;
    this.jahrgang = jahrgang;
    this.group = group;
    this.isClazz = true;
}

Clazz.Jahrgang = function(name){
    return new Clazz(undefined, undefined, undefined, name);
}

Clazz.from_json = function(json){
    if(json["json_class"] == "Clazz"){
        var v = json["v"];
        return new Clazz(v[0], v[1], v[2], v[3], v[4])
    }
    else {
        logger.warn(json["json_class"] + " is not a Clazz!");
        logger.debug(json);
        return false;
    }
}

// Make hashCode and equals "static" for use by Clazz internally and Hashtable.
// Hashtable is faster when you give a equality and hash function to it.

Clazz.hashCode = function(clazz){
    return 'Clazz-7LrCVhVi:' + [clazz.group, clazz.name, clazz.cert, clazz.course, clazz.jahrgang].join(',');
}

Clazz.equals = function(clazz, other){
    return clazz.name == other.name &&
        clazz.course == other.course &&
        clazz.cert == other.cert &&
        clazz.jahrgang == other.jahrgang &&
        clazz.group == other.group;
}

Clazz.prototype = {
    simple: function(no_jahrgang_for_class){
        if(this.full_name() != undefined){
            var str = this.full_name();
            if(no_jahrgang_for_class == undefined)
                str += "(" + this.full_jahrgang() + ")";
            return str;
        }
        else if (this.jahrgang != undefined){
            return this.full_jahrgang();
        }
        else{
            return "";
        }
    },
    full_name: function(){
        if(this.name != undefined){
            if(this.group != undefined){
                return this.name + "-" + this.group;
            }
            else{
                return this.name;
            }
        }
        else{
            return undefined;
        }
    },
    full_jahrgang: function(){
        if(this.jahrgang != undefined){
            if(this.course != undefined){
                return this.jahrgang + "(" + this.course + ")";
            }
            else{
                return this.jahrgang;
            }
        }
        else {
            return undefined;
        }
    },
    ical_file_name: function(){
        var name = this.jahrgang;
        if (this.full_name() != undefined)
            name += "-" + this.full_name();
        if(this.course != undefined)
            name += "-" + this.course;
        if(this.cert != undefined)
            name += "-" + this.cert;

        if(unified)
            name += ".unified";

        return name + ".ical";
    },
    ical_file_href: function(){
        return sprintf("%s/%s", ical_dir, this.ical_file_name());
    },
    ical_file_webcal: function(){
        // TODO
    },
    ical_file_link: function(into){

        var loc, webcal_url, ical_link, links, container;

        loc = location.href.split("/"); loc.pop();
        webcal_url = loc.join("/").replace(/https?:\/\//, "webcal://");

        ical_link = sprintf("%s/%s", ical_dir, this.ical_file_name());

        links = $("<span>");

        container = $("<p>").html(this.simple(false) + ": ").appendTo(links);

        $("<a>").attr({"href": ical_link, "target": "_blank"}).html("Kalender als Datei herunterladen").appendTo(container);
        $(container).append(" | ");
        $("<a>").attr({"href": sprintf("%s/%s/%s", webcal_url, ical_dir, this.ical_file_name()), "target": "_blank"}).html("Kalender in Outlook öffnen").appendTo(container);

        $(container).appendTo(links);

        if(into != undefined){
            $(links).appendTo(into);
            return into;
        }
        else
            return links;
    },
    equals: function(clazz){
        return Clazz.equals(this, clazz);
    },
    parent: function(){

        var ret = _.clone(this);

        if(this.group)
            ret.group = null
        else if(this.name)
            ret.name = null
        else if(this.cert)
            ret.cert = null
        else if(this.course)
            ret.course = null
        else if(this.jahrgang)
            ret = null

        return ret;
    },
    hashCode: function(){
        return Clazz.hashCode(this);
    },
    matchSelfOrParent: function(clazz){
        if(this.equals(clazz))
            return true;
        else {
            var parent = this;
            while((parent = parent.parent()) != null)
                if(parent.equals(clazz)) return true;
            return false;
        }
    }
}

function loadClasses(default_ical_dir){
    $.ajax("classes.json").done(function(data){
        logger.debug("Loaded classes");
        logger.info("JSON file version:", data.json_data_version);

        var keyys, values, loadEvents = true;

        var json_data_version = data.json_data_version.split("."); // 0 - major, 1 - minor

        if (json_data_version[0] == "1"){

            if(Number(json_data_version[1]) >= 1){
                ical_dir = data.ical_dir;
                unified = data.unified;
                default_ical_dir && logger.debug("Called loadClasses with a parameter but classes.json is new enough.");
            }
            else {
                ical_dir = default_ical_dir || "ical";
                unified = false;
            }

            switch(Number(json_data_version[1])){
                case 4:
                    checkForFull = true;
                case 3:
                    loadEvents = data.load_events;
                case 2:
                    if(data.data.json_object_keys){
                        keyys = data.data.keys;
                        values = data.data.values;
                    }
                    else {
                        logger.error("Is no object with json_object_keys!");
                    }
                    break;
                case 1:

                    if(data.json_object_keys){
                        keyys = data["data"][0];
                        values = data["data"][1];

                    }
                    else {
                        logger.error("Stringified keys are not supportet yet.");
                    }
                    break;
                default:
                    logger.error("Unsupported 1.x version.");
                    break;

            }
        }
        else {
            logger.error("Unknown/Unspported JSON data version: " + json_data_version.join("."));
        }

        // Magic happens here: undo JSON object keys.
        if(keyys){
            var populate_func = function(data_evts){

                events = _.map(data_evts.data, function(event){
                    event.start = event.time;
                    if(event.special == "fullWeek"){
                        event.end = moment(event.time).add(5, "days");
                        event.allDay = true;
                    }
                    event.class = Clazz.from_json(event.class);
                    return event;
                });

                logger.debug("Loaded events");

                $(document).ready(function(){

                    // 0 - keys, Clazz
                    // 1 - values, Clazz-es, key's parents
                    // 2 - events, key's events
                    classes = [[], [], []];
                    classesTable = new Hashtable(Clazz.hashCode, Clazz.equals);

                    var select_template = $(Templates.class_select()),
                        select = $("select", select_template);

                    // This popultates both the classes var and the HTML select, why to two loops when we can do one?

                    logger.debug("Document ready");

                    select.html("");
                    $("#modal > div").html("<p>Bitte Klasse auswählen.</p><p class=\"visible-xs\">Das Formular befindet sich im Menü.</p>");
                    $("<option>").html("Bitte auswählen...").attr("value", -1).appendTo(select);

                    $.each(keyys, function(index, element){

                        var o_key = Clazz.from_json(element), // Key as Clazz Object
                            o_parents = [],
                            o_events = [],
                            // out-of-loop var to not re-allocate it each loop
                            clazz,
                            // the index of the class derived from element in classes[0]
                            clazz_index;

                        clazz_index = classes[0].push(o_key) - 1;
                        if(!checkForFull || o_key.full_name())
                            $("<option>").html(o_key.full_name()).attr("value", clazz_index).appendTo(select);

                        // Outer "index" is a numeric key, no index. "values" is an Object no Array.
                        $.each(values[index], function(index, element){

                            clazz = Clazz.from_json(element)

                            o_parents.push(clazz);
                            classes[0].push(clazz);
                        });

                        o_events = _.filter(events, function(o){
                            return o_key.matchSelfOrParent(o.class);
                        })

                        classes[1][clazz_index] = o_parents;
                        classes[2][clazz_index] = o_events;

                        if(!classesTable.containsKey(o_key))
                            classesTable.put(o_key, { parents: o_parents, events: o_events });
                        else {
                            value_container = classesTable.get(o_key);
                            value_container.parents = value_container.parents.concat(o_parents);
                            value_container.events = value_container.events.concat(o_events);
                        }

                    });

                    $(select).removeAttr("disabled");
                    $(select).on("change", classSelect);

                    $('.toolb').html();
                    $('.toolb').removeClass('navbar-text').addClass('navbar-form');
                    $('.toolb').html(select_template);
                    calendar.find('.fc-right').append(Templates.action_button());

                    if(getHashSelection() && select && select[0]){
                        $(select)[0].selectedIndex = Number(getHashSelection());
                        logger.debug("loadClasses / Hash Selection:", getHashSelection());
                        $(select).change();
                    }

                });
            }

            if(loadEvents)
                $.get("data.json").done(function(data){
                    populate_func(data);
                }).fail(function(){
                    populate_func(undefined);
                });
            else{
                logger.info("Configured not to load data.json.");
                populate_func(undefined);
            }

        }
        else {
            logger.error("Could not process classes! (empty)");
        }
    });
}

$(document).ready(function(){

    $(".nojs").hide();
    $(".inner.cover").hide();
    //$(".inner.cover#home").show();
    //$(".nav li#curr-home").addClass("active");

    if(window.location.hash == "")
        window.location.hash="home";

    calendar = $('.calendar');
    calendar.fullCalendar({
        locale: 'de',
        header: {
            left:   'prev,today,next',
            center: 'title',
            right:  'month,listMonth'
        },
        eventClick: function(evt){
            var title_nr = sprintf("%s%s", evt.title, evt.nr ? "#" + evt.nr : "");
            var room_lect = sprintf(" (%s%s%s)", evt.room ? "Raum " + evt.room : "",  evt.room && evt.lect ? "; " : "", evt.lect ? evt.lect : "");
            var str = sprintf("%s%s", title_nr, room_lect == " ()" ? "" : room_lect);
            alert(str);
        }
    });

    $("#modal > div").html("Lade Daten...");

    $(".calendar").swipe( {
        //Generic swipe handler for all directions
        swipeLeft:function() {
            calendar.fullCalendar("next");
        },
        swipeRight: function(){
            calendar.fullCalendar("prev");
        }
    });

    loadClasses();

    $(window).on("hashchange", hashChange);

    hashChange();

    // protected email script by Joe Maller
    // modified by Christoph Schulz, 2016 (For the super paranoid)
    // // JavaScripts available at http://www.joemaller.com
    // // this script is free to use and distribute
    // // but please credit me and/or link to my site
    //
    var cloaked = 'join' + 'out' + '.com';
    cloaked = cloaked.replace(".com", ".de"); // Suuuper paranoid
    cloaked = ('cr' + 'iztovyl' + '@' + cloaked);
    $("#contact #mail a").attr("href", "mailto:" + cloaked).html(cloaked);

});

function hashChange(evt){

    logger.debug("Hash change? ", location.href);
    if(noHashChange-- == 0){
        noHashChange = 0;

        logger.debug("Hash change!");

        var target = window.location.hash; // Location hash incl. #. Keep it.

        if(String(target)){
            $(".inner.cover").hide();

            var selection_match = target.match(/-selection-(\d+)$/);

            // Remove selection string from target
            if(selection_match) target = target.replace(selection_match[0], "");

            $(".inner.cover"  + target).show();
            $(".nav li.active").removeClass("active");
            $(".nav li#curr-" + target.replace("#", "")).addClass("active");

            if(target == '#usage')
                $(document).ready(function(){
                    calendar.fullCalendar('render');
                    $("#modal").addClass("modal-container");
                });

            if(selection_match){
                var select = $(".inner.cover#usage select");
                if(select && select[0] && !select[0].disabled){
                    logger.debug("hashChange / getHashSelection:", getHashSelection());
                    $(select)[0].selectedIndex = Number(getHashSelection());
                    $(select).change();
                }
            }
        }
    }
    else {
        logger.debug("noHashChange:", noHashChange);
    }
}

var hashSelectionRE = /-selection-(\d+)$/;

function getHashSelection(){
    var match = document.location.hash.match(hashSelectionRE);
    return match ? match[1] : match // It's undefined? Return undefined.
}

function setHashSelection(selectedIndex){
    removeHashSelection();
    noHashChange++;
    location.hash = location.hash + "-selection-" + selectedIndex;
}

function removeHashSelection(){
    var newHash = location.hash.replace(hashSelectionRE, "");
    if(location.hash != newHash){
        noHashChange++;
        location.hash = newHash;
    }
}
function classSelect(){

    var target = $("#cal-links");
    target.html("");

    logger.debug("select.value", this.value);

    if(String(this.value) && this.value != -1){

        classes[0][this.value].ical_file_link(target);

        calendar.fullCalendar('removeEventSources');
        calendar.fullCalendar('addEventSource', classes[2][this.value]);

        if(!unified){
            $.each(classes[1][this.value], function(index, element){
                element.ical_file_link($("<li>")).appendTo(target);
            });
        }

        var href = classes[0][this.value].ical_file_href();

        $("#cal-links").show();
        calendar.find('a#download').attr({"href": href, "target": "_blank"});
        calendar.find('a#webcal').attr({"href": href, "target": "_blank"})[0].protocol = "webcal:";
        calendar.find('.fc-right button').attr('title', '');
        calendar.find('.btn').removeClass("disabled");

        $(".help-wo-link").hide();
        $(".help-w-link").html(Templates.help_copy_link({"link": location.href.replace(location.hash, '') + href}));
        $("#modal").hide();

        setHashSelection(this.selectedIndex);

    }
    else{
        $("#cal-links").hide();
        calendar.find('.btn').addClass("disabled");
        calendar.fullCalendar('removeEventSources');
        calendar.find('.fc-right button').attr('title', $('button', Templates.action_button()).attr('title'));

        $(".help-wo-link").show();
        $(".help-w-link").html();

        removeHashSelection();

        $("#modal").show();
        $("#modal > div").html("<p>Bitte Klasse auswählen.</p><p>Das Formular befindet sich im Menü.</p>");
    }
}
