/*
 * (C) 2016 Christoph "criztovyl" Schulz
 * GPLv3 and later.
 * Part of studienplan5, a util to convert HTMLed-XLS Studienplände into iCal files.
 * https://github.com/criztovyl/studienplan5
 */
var classes, jahrgang, clazz;

loadClasses();

function Clazz(name, course, cert, jahrgang, group){
    this.name = name;
    this.course = course;
    this.cert = cert;
    this.jahrgang = jahrgang;
    this.group = group;
}

Clazz.Jahrgang = function(name){
    return new Clazz(undefined, undefined, undefined, name);
}

Clazz.from_json = function(json){
    if(json["json_class"] == "Clazz"){
        v = json["v"];
        return new Clazz(v[0], v[1], v[2], v[3], v[4])
    }
    else {
        console.warn(json["json_class"] + " is not a Clazz!");
        console.log("-")
        console.debug(json);
        return false;
    }
}

Clazz.prototype = {
    simple: function(no_jahrgang_for_class){
        if(this.full_name() != undefined){
            str = this.full_name()
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
        name = this.jahrgang
        if (this.full_name() != undefined)
            name += "-" + this.full_name();
        if(this.course != undefined)
            name += "-" + this.course;
        if(this.cert != undefined)
            name += "-" + this.cert;

        return name;
    },
    ical_file_link: function(into){
        loc = location.href.split("/")
        loc.pop()
        curr_url = loc.join("/").replace("http://", "webcal://");
        link = $("<span>")
        $("<a>").attr({"href": "SS16/" + this.ical_file_name() + ".ical", "target": "_blank"}).html(this.simple(false)).appendTo(link)
        //$(link).append("<br>")
        //$("<a>").attr({"href": curr_url + "/SS16/" + this.ical_file_name() + ".ical", "target": "_blank"}).html("(Outlook)").appendTo(link)
        if(into != undefined){
            $(link).appendTo(into);
            return into;
        }
        else
        return link;
    }
}

function loadClasses(){
    $.ajax("classes.json").done(function(data){
        console.log("Loaded classes");
        classes = [[],[]]; // 0 - keys, 1 - values

        if (data.json_data_version == "1.0"){
            if(data.json_object_keys){
                keyys = data["data"][0];
                values = data["data"][1];

                $(document).ready(function(){
                    select = $(".inner.cover#usage select")[0];
                    $(select).html("");
                    $("<option>").html("Bitte auswählen...").attr("value", -1).appendTo(select);

                    $.each(keyys, function(index, element){

                        key = Clazz.from_json(element);
                        classes[0].push(key);
                        $("<option>").html(key.full_name()).attr("value", index).appendTo(select);

                        values_new = [];

                        $.each(values[index], function(index, element){ // Attention, attention, ein Tann'bäumchen, ein Tann'bäumchen! values[index] => numeric key not index.
                            values_new.push(Clazz.from_json(element))
                        });

                        classes[1].push(values_new);


                    });

                    $(".inner.cover#usage select").removeAttr("disabled");
                    $(select).on("change", classSelect);
                });
            }
            else {
                console.error("Stringified keys are not supportet yet.");
            }
        }
        else {
            console.error("Unknown JSON data version.");
        }

    });
}

$(document).ready(function(){

    $(".inner.cover").hide();
    $(".inner.cover#home").show();
    $(".nav li#curr-home").addClass("active");

    $(window).on("hashchange", hashChange);

    hashChange();

    // protected email script by Joe Maller
    // modified by Christoph Schulz, 2016
    // // JavaScripts available at http://www.joemaller.com
    // // this script is free to use and distribute
    // // but please credit me and/or link to my site
    //
    cloaked = 'join' + 'out' + '.com'
    cloaked = cloaked.replace(".com", ".de")
    cloaked = ('ch' + '.schulz' + '@' + cloaked)
    $("#contact #mail a").attr("href", "mailto:" + cloaked).html(cloaked)
    console.log(cloaked)

});

function hashChange(){
        target = window.location.hash; // Location hash incl. #. Keep it.
        if(String(target)){
            $(".inner.cover").hide();
            $(".inner.cover"  + target).show();
            $(".nav li.active").removeClass("active");
            $(".nav li#curr-" + target.replace("#", "")).addClass("active");
        }
}
function classSelect(){

    target = $(".inner.cover#usage #icals")
    $(target).html("");

    if(String(this.value) && this.value != -1){

        $(target).html("<h2>iCal-Dateien:</h2>")
        $(target).append("<p>Zwei (oder mehr) Dateien,<br>einmal deine Klasse für Studienveranstaltungen, SPE, Praxis usw.<br>und dann noch dein Jahrgang für Klausuren.</p>")

        ul = $("<ul>");

        classes[0][this.value].ical_file_link($("<li>")).appendTo(ul);

        $.each(classes[1][this.value], function(index, element){
            element.ical_file_link($("<li>")).appendTo(ul);
        });

        $(target).append(ul);
        $(target).append("<p>Have fun!</p><p>&lt3</p>")
    }
    else{
        console.log("select.value -1");
    }
}
