/**
 *  timbre / JavaScript Library for Objective Sound Programming
 */
"use strict";

// __BEGIN__
var timbre = function() {
    return timbre.fn.init.apply(timbre, arguments);
};
timbre.VERSION    = "${VERSION}";
timbre.BUILD      = "${DATE}";
timbre.env        = "";
timbre.platform   = "";
timbre.workerpath = "";
timbre.samplerate = 44100;
timbre.channels   = 2;
timbre.cellsize   = 128;
timbre.streamsize = 1024;
timbre.amp        = 0.8;
timbre.verbose    = true;
timbre.dacs       = [];
timbre.timers     = [];
timbre.sys       = null;
timbre.global    = {};
timbre._ = { ev:{}, none: new Float32Array(timbre.cellsize) };

var TimbreObject = function() {};

var SoundSystem = (function() {
    var SoundSystem = function() {
        initialize.apply(this, arguments);
    }, $this = SoundSystem.prototype;
    
    var initialize = function(streamsize, channels) {
        streamsize = streamsize || timbre.streamsize;
        channels   = channels   || timbre.channels;
        channels   = (channels === 1) ? 1 : 2;
        
        this.streamsize = streamsize;
        this.channels   = channels;
        this.L = new Float32Array(streamsize);
        this.R = new Float32Array(streamsize);
        this.cell = new Float32Array(timbre.cellsize);
        this.seq_id = 0;
        
        this._ = {};
        this._.impl = null;
        this._.ison = false;
        this._.cellsize = timbre.cellsize;
    };
    
    $this.bind = function(PlayerKlass) {
        this._.impl = new PlayerKlass(this);
    };

    $this.on = function() {
        if (this._.impl) {
            this._.ison = true;
            this._.impl.on();
        }
    };
    
    $this.off = function() {
        if (this._.impl) {
            this._.impl.off();
            this._.ison = false;
        }
    };
    
    $this.process = function() {
        var cell, L, R;
        var seq_id, dacs, dac, timers, timer;
        var i, imax, j, jmax, k, kmax, n, nmax;
        var saved_i, tmpL, tmpR, amp, x;
        
        cell = this.cell;
        L = this.L;
        R = this.R;
        amp = timbre.amp;
        
        seq_id = this.seq_id;
        
        imax = L.length;
        kmax = this._.cellsize;
        nmax = this.streamsize / kmax;
        saved_i = 0;
        
        // clear
        for (i = imax; i--; ) {
            L[i] = R[i] = 0.0;
        }
        
        // signal process
        for (n = nmax; n--; ) {
            ++seq_id;
            timers = timbre.timers.slice(0);
            for (j = 0, jmax = timers.length; j < jmax; ++j) {
                if ((timer = timers[j]) !== undefined) {
                    timer.seq(seq_id);
                }
            }
            dacs = timbre.dacs.slice(0);
            for (j = 0, jmax = dacs.length; j < jmax; ++j) {
                if ((dac = dacs[j]) !== undefined) {
                    dac.seq(seq_id);
                    tmpL = dac.L;
                    tmpR = dac.R;
                    for (k = 0, i = saved_i; k < kmax; ++k, ++i) {
                        L[i] += tmpL[k];
                        R[i] += tmpR[k];
                    }
                }
            }
            saved_i = i;
        }
        
        // clip
        for (i = imax = L.length; i--; ) {
            x = L[i] * amp;
            if (x < -1.0) {
                x = -1.0;
            } else if (1.0 < x) {
                x = 1.0;
            }
            L[i] = x;
            
            x = R[i] * amp;
            if (x < -1.0) {
                x = -1.0;
            } else if (1.0 < x) {
                x = 1.0;
            }
            R[i] = x;
        }
        
        for (k = kmax; k--; ) {
            cell[k] = L[k] + R[k];
            x = cell[k] * amp * 0.5;
            if (x < -1.0) {
                x = -1.0;
            } else if (1.0 < x) {
                x = 1.0;
            }
            cell[k] = x;
        }
        
        this.seq_id = seq_id;
    };
    
    return SoundSystem;
}());
timbre.sys = new SoundSystem();

Object.defineProperty(timbre, "isEnabled", {
    get: function() {
        return !!timbre.sys._.impl;
    }
});

Object.defineProperty(timbre, "isOn", {
    get: function() {
        return timbre.sys._.ison;
    }
});
Object.defineProperty(timbre, "isOff", {
    get: function() {
        return !timbre.sys._.ison;
    }
});

timbre.on = function() {
    if (!timbre.sys._.ison) {
        timbre.sys.on();
        timbre.fn.do_event(this, "on");
    }
    return timbre;
};

timbre.off = function() {
    if (timbre.sys._.ison) {
        timbre.sys.off();
        timbre.fn.do_event(this, "off");
    }
    return timbre;
};

timbre.addEventListener = function(name, func) {
    var list, rm, i;
    if (typeof func === "function") {
        if (name[0] === "~") {
            name = name.substr(1);
            func.rm = true;
        }
        list = this._.ev[name];
        if (list === undefined) {
            this._.ev[name] = list = [];
        }
        if ((i = list.indexOf(func)) === -1) {
            list.push(func);
        }
    }
    return this;
};
timbre.removeEventListener = function(name, func) {
    var list, i;
    if (typeof name === "string" && name !== "") {
        list = this._.ev[name];
        if (list !== undefined) {
            if ((i = list.indexOf(func)) !== -1) {
                list.splice(i, 1);
            }
        }
    }
    return this;
};
timbre.removeAllEventListeners = function(name) {
    if (typeof name === "string" && name !== "") {
        delete this._.ev[name];
        delete this["on" + name];
    }
    return this;
};


// timbre.functions
timbre.fn = (function(timbre) {
    var fn = {};

    var klasses = {};
    klasses.find = function(key) {
        if (typeof klasses[key] === "function") {
            return klasses[key];
        }
    };

    var defaults = { optional:{}, properties:{} };

    defaults.optional.ar = function() {
        this._.ar = true;
        return this;
    };
    defaults.optional.kr = function() {
        this._.ar = false;
        return this;
    };
    defaults.optional.fixrate = function() {
        return this;
    };
    
    fn.init = function() {
        var args, key, klass, instance, isCloned;
        args = Array.prototype.slice.call(arguments);
        key  = args[0];
        
        switch (typeof key) {
        case "string":
            klass = klasses.find(key);
            if (klass) {
                instance = new klass(args.slice(1));
            }
            break;
        case "number":
            instance = new NumberWrapper([key]);
            break;
        case "boolean":
            instance = new BooleanWrapper([key]);
            break;
        case "function":
            instance = new FunctionWrapper(args);
            break;
        case "object":
            if (key.__proto__._ instanceof TimbreObject) {
                instance = key.clone();
                isCloned = true;
            }
            if (instance === undefined) {
                if (key instanceof Array || key.buffer instanceof ArrayBuffer) {
                    instance = new ArrayWrapper([key]);
                } else {
                    instance = new ObjectWrapper([key]);
                }
            }
            break;
        }
        
        if (instance === undefined) {
            if (key === null) {
                instance = new NullWrapper();
            } else {
                instance = new UndefinedWrapper();
            }
        }
        
        // init
        if (! isCloned) {
            instance.seq_id = -1;
            if (!instance.cell) {
                instance.cell = new Float32Array(timbre.cellsize);
            }
            if (!instance.args) instance.args = [];
            timbre.fn.init_set.call(instance.args);
            
            if (!instance.hasOwnProperty("_")) instance._ = {};
            
            if (typeof !instance._.ev !== "object") instance._.ev = {};
            
            if (typeof instance._.ar !== "boolean") {
                if (typeof instance.__proto__._ === "object") {
                    instance._.ar = !!instance.__proto__._.ar;
                } else {
                    instance._.ar = false;
                }
            }
            if (typeof instance._.mul !== "number") {
                instance._.mul = 1.0;
            }
            if (typeof instance._.add !== "number") {
                instance._.add = 0.0;
            }
        }
        if (instance._post_init) instance._post_init();
        
        return instance;
    };

    defaults.play = function() {
        if (this.dac.isOff) {
            this.dac.on();
            timbre.fn.do_event(this, "play");
        }
        return this;
    };
    defaults.pause = function() {
        if (this.dac.isOn) {
            this.dac.off();
            timbre.fn.do_event(this, "pause");
        }
        return this;
    };
    defaults.bang = function() {
        timbre.fn.do_event(this, "bang");
        return this;
    };
    defaults.seq = function() {
        return this.cell;
    };
    defaults.on = function() {
        this._.ison = true;
        timbre.fn.do_event(this, "on");
        return this;
    };
    defaults.off = function() {
        this._.ison = false;
        timbre.fn.do_event(this, "off");
        return this;
    };
    defaults.clone = function(deep) {
        return timbre(this._.klassname);
    };
    defaults.append = function() {
        this.args.append.apply(this.args, arguments);
        return this;
    };
    defaults.remove = function() {
        this.args.remove.apply(this.args, arguments);
        return this;
    };
    defaults.set = function(key, value) {
        var self;
        self = this;
        while (self !== null) {
            if (Object.getOwnPropertyDescriptor(self, key)) {
                this[key] = value;
                break;
            }
            self = Object.getPrototypeOf(self);
        }
        return this;
    };
    defaults.get = function(key) {
        var self, res;
        self = this;
        while (self !== null) {
            if (Object.getOwnPropertyDescriptor(self, key)) {
                res = this[key];
                break;
            }
            self = Object.getPrototypeOf(self);
        }
        return res;
    };
    defaults.addEventListener        = timbre.addEventListener;
    defaults.removeEventListener     = timbre.removeEventListener;
    defaults.removeAllEventListeners = timbre.removeAllEventListeners;
    
    defaults.properties.isAr = { get: function() { return !!this._.ar; } };
    defaults.properties.isKr = { get: function() { return  !this._.ar; } };
    defaults.properties.isOn  = { get: function() { return !!this._.ison; } };
    defaults.properties.isOff = { get: function() { return  !this._.ison; } };
    
    defaults.properties.dac = {
        set: function(value) {
            if (this._.dac) {
                this._.dac.remove(this);
            }
            if (value !== null) {
                this._.dac = value.append(this);
            } else {
                this._.dac = null; // TODO: ???
            }
        },
        get: function() {
            if (!this._.dac) {
                this._.dac = timbre("dac", this);
            }
            return this._.dac;
        },
    };
    defaults.properties.mul  = {
        set: function(value) {
            if (typeof value === "number") { this._.mul = value; }
        },
        get: function() { return this._.mul; }
    };
    defaults.properties.add  = {
        set: function(value) {
            if (typeof value === "number") { this._.add = value; }
        },
        get: function() { return this._.add; }
    };
    
    fn.set_ar_only = function(object) {
        object.ar = defaults.optional.fixrate;
        object.kr = defaults.optional.fixrate;
        if (!object._) object._ = {};
        object._.ar = true;
    };
    fn.set_kr_only = function(object) {
        object.ar = defaults.optional.fixrate;
        object.kr = defaults.optional.fixrate;
        if (!object._) object._ = {};
        object._.ar = false;
    };
    fn.set_ar_kr = function(object) {
        object.ar = defaults.optional.ar;
        object.kr = defaults.optional.kr;
        if (!object._) object._ = {};
        object._.ar = true;
    };
    fn.set_kr_ar = function(object) {
        object.ar = defaults.optional.ar;
        object.kr = defaults.optional.kr;
        if (!object._) object._ = {};
        object._.ar = false;
    };
    
    fn.register = function(key, klass, func) {
        var name, p, _, i;
        
        if (typeof klass === "function") {
            p = klass.prototype;
            
            _ = new TimbreObject();
            if (typeof p._ === "object") {
                for (i in p._) _[i] = p._[i];
            }
            p._ = _;
            
            for (name in defaults) {
                if (typeof defaults[name] === "function") {
                    if (!p[name]) p[name] = defaults[name];
                }
            }
            for (name in defaults.properties) {
                if (!Object.getOwnPropertyDescriptor(p, name)) {
                    Object.defineProperty(p, name, defaults.properties[name]);
                }
            }
            
            if (typeof p.ar !== "function") {
                fn.set_kr_only(p);
            }
            
            if (typeof key === "string") {            
                if (!func) {
                    p._.klassname = key;
                    klasses[key]  = klass;
                } else {
                    klasses[key] = func;
                }
            }
        }
    };
    
    fn.valist = function(_args) {
        var args;
        var i, imax;
        
        args = [];
        for(i = 0, imax = _args.length; i < imax; ++i) {
            switch (typeof _args[i]) {
            case "number":
            case "boolean":
            case "function":
            case "undefined":
                args.push(timbre(_args[i]));
                break;
            case "object":
                if (_args[i] === null) {
                    args.push(timbre(null));
                } else {
                    args.push(_args[i]);
                }
                break;
            default:
                args.push(timbre(undefined));
                break;
            }
        }
        
        return args;
    };
    
    fn.init_set = (function() {
        var append = function() {
            var args, i;
            args = fn.valist(arguments);
            for (i = args.length; i--; ) {
                if (this.indexOf(args[i]) === -1) {
                    this.push(args[i]);
                }
            }
            return this;
        };
        var remove = function() {
            var i, j;
            for (i = arguments.length; i--; ) {
                if ((j = this.indexOf(arguments[i])) !== -1) {
                    this.splice(j, 1);
                }
            }
            return this;
        };
        var update = function() {
            this.append.apply(this, list);
            return this;
        };
        return function() {
            this.append = append;
            this.remove = remove;
            this.update = update;
            return this;
        };
    }());
    
    fn.do_event = function(obj, name, args) {
        var func, list, i;
        func = obj["on" + name];
        if (typeof func === "function") {
            func.apply(obj, args);
        }

        list = obj._.ev[name];
        if (list !== undefined) {
            for (i = list.length; i--; ) {
                func = list[i];
                func.apply(obj, args);
                if (func.rm) obj.removeEventListener(name, func);
            }
        }
    };
    
    fn.copy_for_clone = function(src, dst, deep) {
        var args, i, imax;
        
        dst._.ar = src._.ar;
        dst._.mul = src._.mul;
        dst._.add = src._.add;
        dst._.ison = src._.ison;
        
        args = src.args;
        if (deep) {
            for (i = 0, imax = args.length; i < imax; ++i) {
                dst.args[i] = args[i].clone(true);
            }
        } else {
            for (i = 0, imax = args.length; i < imax; ++i) {
                dst.args[i] = args[i];
            }
        }
        
        return dst;
    };
    
    return fn;
}(timbre));
timbre.fn.init_set.call(timbre.dacs);
timbre.fn.init_set.call(timbre.timers);


// built-in-types
var NumberWrapper = (function() {
    var NumberWrapper = function() {
        initialize.apply(this, arguments);
    }, $this = NumberWrapper.prototype;
    
    Object.defineProperty($this, "value", {
        set: function(value) {
            var cell, i;
            if (typeof value === "number") {
                this._.value = value;
                cell = this.cell;
                for (i = cell.length; i--; ) {
                    cell[i] = value;
                }
            }
        },
        get: function() {
            return this._.value;
        }
    });
    
    var initialize = function(_args) {
        this._ = {};
        if (typeof _args[0] === "number") {
            this._.value = _args[0];
        } else{
            this._.value = 0;
        }
    };
    
    $this._post_init = function() {
        this.value = this._.value;
    };
    
    $this.clone = function() {
        return timbre(this._.value);
    };
    
    return NumberWrapper;
}());
timbre.fn.register("number", NumberWrapper);

var BooleanWrapper = (function() {
    var BooleanWrapper = function() {
        initialize.apply(this, arguments);
    }, $this = BooleanWrapper.prototype;
    
    Object.defineProperty($this, "value", {
        set: function(value) {
            var cell, i, x;
            this._value = !!value;
            cell = this.cell;
            x = this._.value ? 1 : 0;
            for (i = cell.length; i--; ) {
                cell[i] = x;
            }
        },
        get: function() {
            return this._.value;
        }
    });
    
    var initialize = function(_args) {
        this._ = {};
        if (typeof _args[0] === "boolean") {
            this._.value = _args[0];
        } else{
            this._.value = false;
        }
    };
    
    $this._post_init = function() {
        this.value = this._.value;
    };
    
    $this.clone = function() {
        return timbre(!!this._.value);
    };
    
    return BooleanWrapper;
}());
timbre.fn.register("boolean", BooleanWrapper);

var FunctionWrapper = (function() {
    var FunctionWrapper = function() {
        initialize.apply(this, arguments);
    }, $this = FunctionWrapper.prototype;
    
    Object.defineProperty($this, "value", {
        set: function(value) {
            if (typeof value === "function") {
                this._.value = value;
            }
        },
        get: function() {
            return this._.value;
        }
    });
    Object.defineProperty($this, "args", {
        set: function(value) {
            if (typeof value === "object" && value instanceof Array) {
                this._.args = value;
            }
        },
        get: function() {
            return this._.args;
        }
    });
    
    var initialize = function(_args) {
        var i, _;
        this._ = _ = {};

        i = 0;
        if (typeof _args[i] === "function") {
            _.value = _args[i++];
        } else {
            _.value = null;
        }
        if (typeof _args[i] === "object" && _args[i] instanceof Array) {
            _.args = _args[i++];
        } else {
            _.args = [];
        }
    };
    
    $this.clone = function(deep) {
        return timbre("function", this._.value, this._.args);
    };
    
    $this.bang = function() {
        var _ = this._;
        if (_.value !== null) {
            _.value.apply(this, _.args);
        }
        timbre.fn.do_event(this, "bang");
        return this;
    };
    
    return FunctionWrapper;
}());
timbre.fn.register("function", FunctionWrapper);

var ArrayWrapper = (function() {
    var ArrayWrapper = function() {
        initialize.apply(this, arguments);
    }, $this = ArrayWrapper.prototype;

    Object.defineProperty($this, "value", {
        set: function(value) {
            if (typeof value === "object" && 
                (value instanceof Array ||
                 value.buffer instanceof ArrayBuffer)) {
                this._.value = value;
            }
        },
        get: function() { return this._.value; }
    });
    
    var initialize = function(_args) {
        var value, i, _;
        
        this._ = _ = {};
        
        i = 0;
        if (typeof _args[i] === "object") {
            if (_args[i] instanceof Array ||
                _args[i].buffer instanceof ArrayBuffer) {
                value = _args[i++];
            }
        }
        _.value = (value !== undefined) ? value : new Float32Array(0);
        if (typeof _args[i] === "number") {
            _.mul = _args[i++];    
        }
        if (typeof _args[i] === "number") {
            _.add = _args[i++];    
        }
        _.index = 0;
    };
    
    $this.clone = function(deep) {
        return timbre("array", this._.value, this._.mul, this._.add);
    };
    
    $this.bang = function() {
        this._.index = 0;
        timbre.fn.do_event(this, "bang");
        return this;
    };

    $this.seq = function(seq_id) {
        var _ = this._;
        var cell, value, i;
        cell = this.cell;
        if (this.seq_id !== seq_id) {
            this.seq_id = seq_id;
            value = _.value[_.index] * _.mul + _.add;
            for (i = cell.length; i--; ) {
                cell[i] = value;
            }
            if ((++_.index) === _.value.length) _.index = 0;
        }
        return cell;
    };
    
    return ArrayWrapper;
}());
timbre.fn.register("array", ArrayWrapper);

var ObjectWrapper = (function() {
    var ObjectWrapper = function() {
        initialize.apply(this, arguments);
    }, $this = ObjectWrapper.prototype;
    
    Object.defineProperty($this, "value", {
        set: function(value) {
            if (typeof value === "object") {
                this._.value = value;
            }
        },
        get: function() { return this._.value; }
    });
    
    var initialize = function(_args) {
        this._ = {};
        if (typeof _args[0] === "object") {
            this._.value = _args[0];
        } else{
            this._.value = {};
        }
    };
    
    $this.clone = function(deep) {
        return timbre("object", this._.value);
    };
    
    return ObjectWrapper;
}());
timbre.fn.register("object", ObjectWrapper);

var UndefinedWrapper = function() {};
timbre.fn.register("undefined", UndefinedWrapper);

var NullWrapper = function() {};
timbre.fn.register("null", NullWrapper);


// __END__
global.T = global.timbre = timbre;
module.exports = timbre;

global.NumberWrapper    = NumberWrapper;
global.BooleanWrapper   = BooleanWrapper;
global.FunctionWrapper  = FunctionWrapper;
global.UndefinedWrapper = UndefinedWrapper;
global.NullWrapper      = NullWrapper;

var should = require("should");
global.object_test = function(klass, instance) {
    describe("timbre(...)", function() {
        it("should return new instance", function() {
            should.exist(instance);
            instance.should.be.an.instanceOf(klass);
        });
    });
    describe("#args", function() {
        it("should be an instance of Array", function() {
            instance.args.should.be.an.instanceOf(Array);
        });
    });
    describe("#cell", function() {
        it("should be an Float32Array(timbre.cellsize)", function() {
            instance.cell.should.be.an.instanceOf(Float32Array);
            instance.cell.should.have.length(timbre.cellsize);
        });
    });
    describe("#seq()", function() {
        it("should return Float32Array(timbre.cellsize)", function() {
            var _;
            instance.seq.should.be.an.instanceOf(Function);
            _ = instance.seq(0);
            _.should.be.an.instanceOf(Float32Array);
            _.should.have.length(timbre.cellsize);
        });
    });
    describe("#on()", function() {
        it("should return self", function() {
            instance.on.should.be.an.instanceOf(Function);
            instance.on().should.equal(instance);
        });
        it("should call 'on' event", function() {
            var _ = false;
            instance.addEventListener("on", function() { _ = true; });
            instance.on();
            _.should.equal(true);
        });
    });
    describe("#off()", function() {
        it("should return self", function() {
            instance.off.should.be.an.instanceOf(Function);
            instance.off().should.equal(instance);
        });
        it("should call 'off' event", function() {
            var _ = false;
            instance.addEventListener("off", function() { _ = true; });
            instance.off();
            _.should.equal(true);
        });
    });
    describe("#set()", function() {
        it("should return self", function() {
            instance.set.should.be.an.instanceOf(Function);
            instance.set().should.equal(instance);
        });
    });
    describe("#get()", function() {
        it("should return self", function() {
            instance.get.should.be.an.instanceOf(Function);
            should.equal(instance.get(), undefined);
        });
    });
    describe("#bang()", function() {
        it("should return self", function() {
            instance.bang.should.be.an.instanceOf(Function);
            instance.bang().should.equal(instance);
        });
        it("should call 'bang' event", function() {
            var _ = false;
            instance.addEventListener("bang", function() { _ = true; });
            instance.bang();
            _.should.equal(true);
        });
    });
    describe("#clone()", function() {
        it("should return an instance of a same class", function() {
            var _;
            instance.clone.should.be.an.instanceOf(Function);
            _ = instance.clone();
            _.should.be.an.instanceOf(instance._.klass);
        });
    });
};

if (module.parent && !module.parent.parent) {
    describe("NumberWrapper", function() {
        var instance = timbre(100);
        object_test(NumberWrapper, instance);
        describe("#value", function() {
            it("should equal 100", function() {
                instance.value.should.equal(100);
            });
            it("should changed", function() {
                instance.value = 10;
                instance.value.should.equal(10);
                instance.cell[0].should.equal(10);
            });
            it("should not changed with no number", function() {
                instance.value = "1";
                instance.value.should.equal(10);
            });
        });
        describe("#clone()", function() {
            it("should have same values", function() {
                timbre(instance).value.should.equal(instance.value);
            });
        });
    });
    describe("BooleanWrapper", function() {
        var instance = timbre(true);
        object_test(BooleanWrapper, instance);
        describe("#value", function() {
            it("should equal true", function() {
                instance.value.should.equal(true);
            });
            it("should changed", function() {
                instance.value = false;
                instance.value.should.equal(false);
                instance.cell[0].should.equal(0);
                
                instance.value = true;
                instance.value.should.equal(true);
                instance.cell[0].should.equal(1);
                
                instance.value = false;
                instance.value = 1000;
                instance.value.should.equal(true);
            });
        });
        describe("#clone()", function() {
            it("should have same values", function() {
                timbre(instance).value.should.equal(instance.value);
            });
        });
    });
    describe("FunctionWrapper", function() {
        var instance = timbre(function(x) { return 1.0-x; }, 0, 0.5, 2, 100);
        object_test(FunctionWrapper, instance);
        describe("#func", function() {
            it("should be an instance of Function", function() {
                instance.func.should.be.an.instanceOf(Function);
            });
        });
        describe("#freq", function() {
            it("should be an instance of Object", function() {
                object_test(NumberWrapper, instance.freq);
            });
        });
        describe("#phase", function() {
            it("should equal 0.5", function() {
                instance.phase.should.equal(0.5);
            });
        });
        describe("#mul", function() {
            it("should equal 2", function() {
                instance.mul.should.equal(2);
            });
        });
        describe("#add", function() {
            it("should equal 100", function() {
                instance.add.should.equal(100);
            });
        });
        describe("#seq()", function() {
            it("should return signal ((1-0.5)*2+100)", function() {

                instance.phase = 0.5;
                instance.freq  = 0;
                instance.mul   = 2;
                instance.add   = 100;
                instance.on().seq(1).should.eql(timbre( (1-0.5)*2+100 ).seq(0));
            });
            it("should return signal not ((1-0.5)*2+100)", function() {
                instance.phase = 0.5;
                instance.freq  = 800;
                instance.mul   = 2;
                instance.add   = 100;
                instance.on().seq(2).should.not.eql(timbre( (1-0.5)*2+100 ).seq(0));
            });
        });
        describe("#clone()", function() {
            it("should have same values", function() {
                var _ = timbre(instance);
                _.func.should.equal(instance.func);
                _.freq.should.equal(instance.freq);
                _.phase.should.equal(instance.phase);
                _.mul.should.equal(instance.mul);
                _.add.should.equal(instance.add);
            });
        });
    });
    describe("NullWrapper", function() {
        object_test(NullWrapper, timbre(null));
    });
    describe("UndefinedWrapper", function() {
        object_test(UndefinedWrapper, timbre(undefined));
    });
}
