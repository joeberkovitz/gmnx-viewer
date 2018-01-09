// Encapsulates the view of GMNX content

const svgNS = 'http://www.w3.org/2000/svg';

class Rational {
    constructor(num, den) {
        this.numerator = num;
        this.denominator = den;
    }

    toNumber() {
        return this.numerator / this.denominator;
    }
}

class MnxUtils {
    static parseRational(str) {
        let m = str.match(/^(-?\d+)\/(\d+)$/);
        if (m) {
            return new Rational(Number.parseInt(m[1]), Number.parseInt(m[2]));
        }
    }

    static isPowerOf2(number) {
        let ln2 = Math.log(number) / Math.log(2);
        return (ln2 - Math.floor(ln2)) == 0;
    }

    static parseNoteValueQuantity(str) {
        let m = str.match(/^(\d*)([\*\/])(\d+)([d]*)$/);
        if (m) {
            let multiplier = 1;
            if (m[1].length > 0) {
                multiplier = Number.parseInt(m[1]);
            }
            let fractional = m[2] == '/';
            let value = Number.parseInt(m[3]);
            let dots = m[4].length;

            if (!MnxUtils.isPowerOf2(value)) {
                return undefined;
            }

            if (fractional) {
                value = 1 / value;
            }

            if (dots > 0) {
                multiplier *= Math.pow(2, dots + 1) - 1;
                value /= Math.pow(2, dots);
            }
            return (value < 1) ? new Rational(multiplier, 1 / value) : new Rational(multiplier * value, 1);
        }
    }
}

// Represents a view of an SVG page in a score. The file is loaded into an
// <iframe> in order to sandbox its ID namespace. The loading must take place
// via AJAX into a blank frame, giving the iframe document the same origin as
// the source document.

class GmnxView {

    constructor(element) {
        // DOM element used for display
        this.element$ = $(element);

        this.element$.empty();
        this.iframe$ = $('<iframe id="_gmnx_view" src="about:blank" width="1024px" height="1024px" frameborder="0"></iframe>');
        this.element$.append(this.iframe$);

        let iframe = this.iframe$[0];
        this.frameDoc = iframe.document;
        if (iframe.contentDocument)
            this.frameDoc = iframe.contentDocument;
        else if (iframe.contentWindow)
            this.frameDoc = iframe.contentWindow.document;

        this.frameDoc.open();
        this.frameDoc.write('<html><head></head><body><div id="content"></div></body></html>');
        this.frameDoc.close();
    }

    // Inline an SVG DOM from the given external URL.
    // Returns a Promise which resolves once the material is displayed.
    display(url) {
        //     $(this.frameDoc.getElementById("content")).load(url, () => resolve());
        let xhr = $.get({
            url: url,
            dataType: 'text',
        });
        xhr.then(data => {
            this.load(data);
        });
        return xhr;
    }

    // Load an SVG DOM from a string
    load(data) {
        this.frameDoc.getElementById("content").innerHTML = data;
    }

    // Get an SVG element by ID within the DOM
    getSvgElement(id) {
        return this.frameDoc.getElementById(id);
    }

    createSvgElement(name) {
        return this.frameDoc.createElementNS(svgNS, name);
    }
}

// Represents a decoration within a GmnxView that can be displayed and/or hidden.

class GmnxViewDecoration {
    constructor(performance, region) {
        this.performance = performance;
        this.view = region.view;
        this.elementId = region.region;
        this.rect = region.rect || this.svg.getBBox();
        this.highlighted = false;
        this.start = region.start;
        this.end = region.end;
    }

    get svg() {
        return this.view.getSvgElement(this.elementId);
    }

    show() {
        if (!this.highlightSvg$) {
           this.highlightSvg$ = this.create();
        }

        if (!this.highlighted) {
            $(this.svg.parentElement).append(this.highlightSvg$);
            this.highlighted = true;
        }

        return this;
    }

    create() {
        // Build the SVG element for this decoration
    }

    hide() {
        if (this.highlighted) {
            this.highlightSvg$.remove();
            this.highlighted = false;
        }

        return this;
    }
}

// Represents a region of the view which can be highlighted or in which a cursor may be displayed.
class GmnxViewRegion extends GmnxViewDecoration {
    create() {
        return $(this.view.createSvgElement("rect"))
            .attr("x", this.rect.x)
            .attr("y", this.rect.y)
            .attr("width", this.rect.width)
            .attr("height", this.rect.height)
            .attr("fill", "blue")
            .attr("fill-opacity", "0.2");
    }

}

class GmnxViewGraphic extends GmnxViewDecoration {
    create() {
        return $(this.view.createSvgElement("rect"))
            .attr("x", this.rect.x)
            .attr("y", this.rect.y)
            .attr("width", this.rect.width)
            .attr("height", this.rect.height)
            .attr("fill", "#009900")
            .css("mix-blend-mode", "lighten");
    }

}

class GmnxViewCursor extends GmnxViewDecoration {
    constructor(performance, region) {
        super(performance, region);
        if (region.cursorStart) {
          this.cursorStart = this.cursorFromEdge(region.cursorStart);
        }
        if (region.cursorEnd) {
          this.cursorEnd = this.cursorFromEdge(region.cursorEnd);
        }
    }

    cursorFromEdge(str) {
      switch (str) {
        case "left":
          return {
            x1: this.rect.x,                   y1: this.rect.y,
            x2: this.rect.x,                   y2: this.rect.y + this.rect.height
          };
        case "right":
          return {
            x1: this.rect.x + this.rect.width, y1: this.rect.y,
            x2: this.rect.x + this.rect.width, y2: this.rect.y + this.rect.height
          };
        case "top":
          return {
            x1: this.rect.x,                   y1: this.rect.y,
            x2: this.rect.x + this.rect.width, y2: this.rect.y
          };
        case "bottom":
          return {
            x1: this.rect.x,                   y1: this.rect.y + this.rect.height,
            x2: this.rect.x + this.rect.width, y2: this.rect.y + this.rect.height
          };
      }
    }
    
    create() {
        return $(this.view.createSvgElement("line"))
            .attr("stroke", "blue")
            .attr("stroke-width", "1");
    }

    show() {
        super.show();

        this.highlightSvg$
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", 0);

        if (this.interval === undefined) {
            this.interval = setInterval(() => {
              let time = Tone.Transport.seconds / this.performance.timescale;
              if (this.highlighted) {
                  let p = (time - this.start) / (this.end - this.start);
                  for (let lineProp of ['x1', 'x2', 'y1', 'y2']) {
                      this.highlightSvg$
                          .attr(lineProp, this.cursorStart[lineProp] + p * (this.cursorEnd[lineProp] - this.cursorStart[lineProp]))
                  }
              }
            }, 50);
        }

        return this;
    }

    hide() {
        super.hide();

        if (this.interval !== undefined) {
          clearInterval(this.interval);
          this.interval = undefined;
        }
        return this;
    }
}

class GmnxPerformance {
    constructor(viewer) {
        this.viewer = viewer;
        this.tempos = [];
        this.regions = [];
        this.activeRegions = new Map();
    }

    addTempo(start, unitSeconds) {
        this.tempos.push({start, unitSeconds});
    }

    addRegion(start, end, view, region, cursorStart, cursorEnd) {
        this.regions.push({start, end, view, region, cursorStart, cursorEnd});
    }

    scheduleRegions() {
        this.regions.forEach(pr => {
            let vr;
            if (pr.cursorStart && pr.cursorEnd) {
                vr = new GmnxViewCursor(this, pr);
            }
            else {
                vr = new GmnxViewRegion(this, pr);
            }
            Tone.Transport.schedule(time => {
              this.activeRegions.set(vr, vr);
              vr.show();
            }, pr.start * this.timescale);
            Tone.Transport.schedule(time => {
                vr.hide();
                this.activeRegions.delete(vr);
            }, pr.end * this.timescale);
        });
    }

    prepare() {
        if (!this.scheduled) {
            this.tempos.sort((a, b) => a.start - b.start);

            if (this.tempos.length == 0) {
              this.addTempo(0, 1);
            }

            this.timescale = this.tempos[0].unitSeconds;
            Tone.Transport.bpm.value = 60;

            Tone.Transport.cancel(0);
            this.schedulePerformance();
            this.scheduleRegions();
            this.scheduled = true;
        }
    }

    play() {
        this.stop();

        Tone.Transport.seconds = 0;
        this.startTime = Tone.Transport.context.currentTime;
        Tone.Transport.start(this.startTime + 0.1);
    }

    stop() {
      Tone.Transport.stop();
      this.activeRegions.forEach(vr => {
        vr.hide();
      });
      this.activeRegions.clear()
    }
}

class GmnxPerformanceData extends GmnxPerformance {
    constructor(viewer) {
      super(viewer);
      this.events = [];
    }

    addEvent(start, frequency, duration, dynamics, view, graphics) {
        this.events.push({start, frequency, duration, dynamics, view, graphics});
    }

    schedulePerformance() {
        this.events.sort((a, b) => a.start - b.start);

        //create a synth and connect it to the master output (your speakers)
        this.synth = new Tone.PolySynth(32, Tone.Synth).toMaster();

        this.events.forEach(pe => {
            let viewGraphic;
            if (pe.view && pe.graphics) {
                pe.viewGraphics = [];
                pe.graphics.forEach(g => {
                    let viewGraphic = new GmnxViewGraphic(this, {
                        start: pe.start,
                        end: pe.start + pe.duration,
                        view: pe.view,
                        region: g
                    });
                    viewGraphic.svg.onclick = () => {
                        this.synth.triggerAttackRelease(pe.frequency, 1, 0, 1);
                    };
                    pe.viewGraphics.push(viewGraphic);
                });
            }

            Tone.Transport.schedule(time => {
                this.synth.triggerAttackRelease(pe.frequency, pe.duration * this.timescale, time, pe.dynamics / 127);
            }, pe.start * this.timescale)

            if (pe.viewGraphics) {
                Tone.Transport.schedule(time => {
                    pe.viewGraphics.forEach(g => {
                        g.show();
                        this.activeRegions.set(g, g);
                    });
                }, pe.start * this.timescale);
                Tone.Transport.schedule(time => {
                    pe.viewGraphics.forEach(g => {
                        g.hide();
                        this.activeRegions.delete(g);
                    });
                }, (pe.start + pe.duration) * this.timescale)
            }
        });
    }

    start() {
        super.start();
    }

    stop() {
        super.stop();
        if (this.synth) {
            this.synth.releaseAll();
        }
    }
}

class GmnxPerformanceAudio extends GmnxPerformance {
    constructor(viewer) {
      super(viewer);
    }

    addMedia (src) {
      return new Promise((resolve, reject) => {
        this.buffer = new Tone.Buffer(src, resolve, reject);
      });
    }

    addRegion(start, end, view, region, cursorStart, cursorEnd) {
      this.regions.push({start, end, view, region, cursorStart, cursorEnd});
    }

    schedulePerformance() {
      Tone.Transport.schedule(time => {
        this.source = new Tone.BufferSource(this.buffer).toMaster().start(time);
      }, 0);
    }

    stop() {
      super.stop();

      if (this.source) {
        this.source.stop();
        this.source = null;
      }
    }
}

// Top level object exposing the viewer API

class GmnxViewer {
    // Create a new viewer that loads its content into a given <div>.
    //
    // options values:
    //      elementName - name of the <div> which will contain the viewer content

    constructor(options) {
        this.options = options;
        this.element = document.getElementById(options.elementName);
    }

    load(url) {
        if (url.indexOf('/') >= 0) {
            this.base = url.replace(/\/[^\/]+$/, '/');            
        }
        else {
            this.base = '';
        }

        return new Promise((resolve, reject) => {
            $.get({
                url: url,
                dataType: 'xml',
                success: data => {
                    this.parse(data).then(
                        value => resolve(this),
                        reason => reject(reason)
                    )
                },
                error: reason => reject(reason)
            });
        });
    }

    parseTempos(perfElement, performance) {
        $(perfElement).find('performance-tempo').each((index, pt) => {
            let start = Number.parseFloat($(pt).attr('start')) || 0.0;
            let beat = MnxUtils.parseNoteValueQuantity($(pt).attr('beat'));
            let bpm = Number.parseInt($(pt).attr('bpm'));
            performance.addTempo(start, (60 / bpm) / beat.toNumber());
        });
    }

    parseRegions(perfElement, performance) {
        $(perfElement).find('performance-region').each((index, pr) => {
            let start = Number.parseFloat($(pr).attr('start'));
            let end = Number.parseFloat($(pr).attr('end'));
            let view = this.views.get($(pr).attr('view'));
            let region = $(pr).attr('region');
            let cursorStart = $(pr).attr('cursor-start');
            let cursorEnd = $(pr).attr('cursor-end');
            performance.addRegion(start, end, view, region, cursorStart, cursorEnd);
        });
    }

    parse(xml) {
        this.views = new Map();

        let gmnx = $(xml).find('gmnx').first();
        let promises = [];

        let scoreViews = gmnx.find('score-view');
        scoreViews.each((index, sv) => {
            let view = new GmnxView(this.element);
            this.views.set($(sv).attr('id'), view);

            let viewUrl = $(sv).attr('view');
            if (viewUrl) {
                let viewPromise = view.display(this.base + viewUrl);
                viewPromise.then(() => {
                   $(sv).find('score-mapping').each((index, sm) => {
                      // TODO: process semantic score mappings here                  
                   });
                })
                promises.push(viewPromise);
            }
            else {
                // SVG is inline
                view.load(new XMLSerializer().serializeToString($(sv).find('svg')[0]));
            }
        });

        let scoreData = gmnx.find('performance-data');
        this.performances = [];
        scoreData.each((index, pd) => {
            let perfdata = new GmnxPerformanceData(this);
            this.performances.push(perfdata);

            this.parseTempos(pd, perfdata);
            this.parseRegions(pd, perfdata);

            // Process performance events. Note that parts are completely ignored at the moment.
            $(pd).find('performance-event').each((index, pe) => {
                let start = Number.parseFloat($(pe).attr('start'));
                let frequency = Number.parseFloat($(pe).attr('pitch'));
                let duration = Number.parseFloat($(pe).attr('duration'));
                let dynamics = Number.parseFloat($(pe).attr('dynamics'));
                let view = this.views.get($(pe).attr('view'));
                let graphics = $(pe).attr('graphics');
                if (graphics) {
                  graphics = graphics.split(/\s+/);
                }
                perfdata.addEvent(start, frequency, duration, dynamics, view, graphics);
            });
        });

        let scoreAudio = gmnx.find('performance-audio');
        scoreAudio.each((index, pa) => {
            let perfaudio = new GmnxPerformanceAudio(this);
            this.performances.push(perfaudio);

            this.parseTempos(pa, perfaudio);
            this.parseRegions(pa, perfaudio);

            // Process performance media. It's assumed that there's only one.
            let media = $(pa).find('performance-audio-media').first();
            promises.push(perfaudio.addMedia(this.base + $(media).attr('src')));
        });

        let bigPromise = Promise.all(promises);
        bigPromise.then(() => {
            this.performances.forEach(perf => perf.prepare());
        });
        return bigPromise;
    }
}
