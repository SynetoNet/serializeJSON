const { serializeJSON, splitType, splitInputNameIntoKeysArray, deepSet, defaultOptions, setDefaultOptions } = require('./serializejson.js');

describe("serializeJSON", function() {
    var obj, formElement;

    it("accepts a HTMLFormElement", function() {
        formElement = form([
            inputText("1", "1"),
            inputText("2", "2"),
        ]);
        obj = serializeJSON(formElement);
        expect(obj).toEqual({"1": "1", "2": "2"});
    });
    
    it("serializes simple one-level attributes", function() {
        formElement = form([
            inputText("firstName", "Mario"),
            inputText("lastName", "Izquierdo"),
        ]);

        obj = serializeJSON(formElement);
        expect(obj).toEqual({
            firstName: "Mario",
            lastName: "Izquierdo"
        });
    });

    it("serializes nested object attributes", function() {
        formElement = form([
            inputText("address[city]",        "San Francisco"),
            inputText("address[state][name]", "California"),
            inputText("address[state][abbr]", "CA"),
        ]);

        obj = serializeJSON(formElement);
        expect(obj).toEqual({
            address: {
                city: "San Francisco",
                state: { name: "California", abbr: "CA" }
            }
        });
    });

    it("serializes attribute names that look like integers as string object keys by default", function() {
        formElement = form([
            inputText("foo[0]",    "zero"),
            inputText("foo[1]",    "one"),
            inputText("foo[2][0]", "two-zero"),
            inputText("foo[2][1]", "two-one"),
        ]);

        obj = serializeJSON(formElement);
        expect(obj).toEqual({
            "foo": {
                "0": "zero",
                "1": "one",
                "2": {
                    "0": "two-zero",
                    "1": "two-one"
                }
            }
        });
    });

    describe("unindexed arrays ([])", function() {
        it("pushes elements into the array", function() {
            formElement = form([
                inputText("jobbies[]", "code"),
                inputText("jobbies[]", "climbing"),
            ]);

            obj = serializeJSON(formElement);
            expect(obj).toEqual({
                jobbies: ["code", "climbing"]
            });
        });

        it("pushes nested objects if nested keys are repeated", function() {
            formElement = form([
                inputText("projects[][name]",     "serializeJSON"),
                inputText("projects[][language]", "javascript"),

                inputText("projects[][name]",     "bettertabs"),
                inputText("projects[][language]", "ruby"),

                inputText("projects[][name]",     "formwell"),
                inputText("projects[][morelanguages][]", "coffeescript"),
                inputText("projects[][morelanguages][]", "javascript"),

                inputText("people[][name][first]", "Bruce"),
                inputText("people[][name][last]",  "Lee"),
                inputText("people[][age]:number", "33"),

                inputText("people[][name][first]", "Morihei"),
                inputText("people[][name][last]", "Ueshiba"),
                inputText("people[][age]:number", "86"),
            ]);

            obj = serializeJSON(formElement);
            expect(obj).toEqual({
                projects: [
                    { name: "serializeJSON", language: "javascript" },
                    { name: "bettertabs",    language: "ruby" },
                    { name: "formwell",      morelanguages: ["coffeescript", "javascript"] },
                ],
                people: [
                    { name: {first: "Bruce", last: "Lee"}, age: 33 },
                    { name: {first: "Morihei", last: "Ueshiba"}, age: 86 }
                ],
            });
        });
    });

    describe("select multiple", function() {
        it("serializes all the selected elements as an array", function() {
            const options = [
                selectOption("1"),
                selectOption("2"),
                selectOption("3"),
            ];
            options[0].selected = true;
            options[2].selected = true;
            const inputs = [
                inputSelectMultiple("camels[]", options),
            ];
            formElement = form(inputs);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({camels: ["1", "3"]});
        });
        it("ignores the field if nothing is selected", function() {
            formElement = form([
                inputSelectMultiple("camels[]", [
                    selectOption("1"),
                    selectOption("2"),
                    selectOption("3"),
                ]),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({}); // nothing serialized
        });
        it("can be set to empty array if using a hidden field", function() {
            formElement = form([
                inputHidden("camels:array", "[]"),
                inputSelectMultiple("camels[]", [
                    selectOption("1"),
                    selectOption("2"),
                    selectOption("3"),
                ]),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({camels: []}); // empty array from the hidden field
        });
    });

    it("overrides existing properties and keeps the last property value only", function() {
        formElement = form([
            inputText("str", "String"),
            inputText("str", "String Override"),

            inputText("array", "a string that was there before"),
            inputText("array[]", "one"),
            inputText("array[]", "two"),

            inputText("crosstype",         "str"),
            inputText("crosstype:number",  "2"),
            inputText("crosstype:boolean", "true"),

            inputHidden("object", ""),
            inputText("object[nested]",         "blabla"),
            inputText("object[nested][nested]", "final value"),
        ]);

        obj = serializeJSON(formElement);
        expect(obj).toEqual({
            str: "String Override",
            array: ["one", "two"],
            crosstype: true,
            object: { nested: { nested: "final value" }}
        });
    });

    describe("unchecked checkboxes", function() {
        it("are ignored by default like in regural HTML forms and the jQuery.serializeArray function", function() {
            formElement = form([
                inputCheckbox("check1", "yes"),
                inputCheckbox("check2", "yes"),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({}); // empty because unchecked checkboxes are ignored
        });

        it("are ignored also in arrays", function() {
            formElement = form([
                inputCheckbox("flags[]", "green"),
                inputCheckbox("flags[]", "red"),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({});
        });

        it("could use a hidden field with type :array to force an empty array in an array of unchecked checkboxes", function() {
            formElement = form([
                inputHidden("flags:array", "[]"),
                inputCheckbox("flags[]", "green"),
                inputCheckbox("flags[]", "red"),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({"flags": []});

            formElement.querySelector("input[value=\"red\"]").checked = true;
            obj = serializeJSON(formElement);
            expect(obj).toEqual({"flags": ["red"]});
        });

        it("can be combined with hidden fields to set the false value", function() {
            const inputs = [
                inputHidden("truthy", "0"),
                inputCheckbox("truthy", "1"), // should keep "1"
                inputHidden("falsy", "0"),
                inputCheckbox("falsy", "1"), // should keep "0", from the hidden field
            ];
            inputs[1].checked = true;
            formElement = form(inputs);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({
                truthy: "1", // from the checkbok
                falsy:  "0"  // from the hidden field
            });
        });

        it("are ignored if they have no name attribute", function() {
            const inputs = [document.createElement('input'), document.createElement('input')];
            inputs.forEach(function (input) {
                input.type = 'checkbox';
                input.value = 'yes';
            });
            formElement = form(inputs);
            obj = serializeJSON(formElement, {checkboxUncheckedValue: "NOPE"});
            expect(obj).toEqual({});
        });

        it("use the checkboxUncheckedValue option if defined", function() {
            formElement = form([
                inputCheckbox("check1", "yes"),
                inputCheckbox("check2", "yes"),
            ]);
            obj = serializeJSON(formElement, {checkboxUncheckedValue: "NOPE"});
            expect(obj).toEqual({check1: "NOPE", check2: "NOPE"});
        });

        it("use the attr data-unchecked-value if defined", function() {
            const inputs =[
                inputCheckbox("check1", "yes"), // ignored
                inputCheckbox("check2", "yes"),
            ];
            inputs[1].setAttribute("data-unchecked-value", "NOPE");
            formElement = form(inputs);

            obj = serializeJSON(formElement); // NOTE: no checkboxUncheckedValue used
            expect(obj).toEqual({check2: "NOPE"});
        });
    });

    describe(":number type", function() {
        it("parses numbers", function() {
            formElement = form([
                inputText("i1:number", "10"),
                inputText("i2:number", "10.5"),
                inputText("un",        "10"),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({i1: 10, i2: 10.5, un: "10"});
        });
        it("parses non numbers to NaN", function(){
            formElement = form([
                inputText("i1:number", "text"),
                inputText("i2:number", "null"),
                inputText("i3:number", "false"),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({i1: NaN, i2: NaN, i3: NaN});
        });
    });

    describe(":boolean type", function() {
        it("parses anything that looks truthy to true", function() {
            formElement = form([
                inputText("b1:boolean", "true"),
                inputText("b2:boolean", "TRUE"),
                inputText("b3:boolean", "yes"),
                inputText("b4:boolean", "[1,2,3]"),
                inputText("b5:boolean", "Bla bla bla bla ..."),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({b1: true, b2: true, b3: true, b4: true, b5: true});
        });
        it("parses anything that looks falsy to false", function() {
            formElement = form([
                inputText("b1:boolean", "false"),
                inputText("b2:boolean", "null"),
                inputText("b3:boolean", "undefined"),
                inputText("b4:boolean", ""),
                inputText("b5:boolean", "0"),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({b1: false, b2: false, b3: false, b4: false, b5: false});
        });
    });
    describe(":null type", function() {
        it("parses anything that looks falsy to null", function() {
            formElement = form([
                inputText("b1:null", "false"),
                inputText("b2:null", "null"),
                inputText("b3:null", "undefined"),
                inputText("b4:null", ""),
                inputText("b5:null", "0"),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({b1: null, b2: null, b3: null, b4: null, b5: null});
        });
        it("keeps anything that looks truthy as string", function() {
            formElement = form([
                inputText("b1:null", "true"),
                inputText("b2:null", "TRUE"),
                inputText("b3:null", "yes"),
                inputText("b4:null", "[1,2,3]"),
                inputText("b5:null", "Bla bla bla bla ..."),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({b1: "true", b2: "TRUE", b3: "yes", b4: "[1,2,3]", b5: "Bla bla bla bla ..."});
        });
    });
    describe(":string type", function() {
        it("keeps everything as string", function() {
            formElement = form([
                inputText("b1:string", "true"),
                inputText("b2:string", "TRUE"),
                inputText("b3:string", "yes"),
                inputText("b4:string", "[1,2,3]"),
                inputText("b5:string", "Bla bla bla bla ..."),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({b1: "true", b2: "TRUE", b3: "yes", b4: "[1,2,3]", b5: "Bla bla bla bla ..."});
        });
    });
    describe(":array type", function() {
        it("parses arrays with JSON.parse", function() {
            formElement = form([
                inputText("b1:array", "[]"),
                inputText("b2:array", "[\"my\", \"stuff\"]"),
                inputText("b3:array", "[1,2,3]"),
                inputText("b4:array", "[1,[2,[3]]]"),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({b1: [], b2: ["my", "stuff"], b3: [1,2,3], b4: [1,[2,[3]]]});
        });
        it("raises an error if the array can not be parsed", function() {
            formElement = form([
                inputText("b1:array", "<NOT_AN_ARRAY>"),
            ]);
            expect(function(){serializeJSON(formElement);}).toThrow();
        });
    });
    describe(":object type", function() {
        it("parses objects with JSON.parse", function() {
            formElement = form([
                inputText("b1:object", "{}"),
                inputText("b2:object", "{\"my\": \"stuff\"}"),
                inputText("b3:object", "{\"my\": {\"nested\": \"stuff\"}}"),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({b1: {}, b2: {"my": "stuff"}, b3: {"my": {"nested": "stuff"}}});
        });
        it("raises an error if the obejct can not be parsed", function() {
            formElement = form([
                inputText("b1:object", "<NOT_AN_OBJECT>"),
            ]);
            expect(function(){serializeJSON(formElement);}).toThrow();
        });
    });
    describe(":skip type", function() {
        it("removes the field from the parsed result", function() {
            formElement = form([
                inputText("b1",           "Im in"),
                inputText("b2:skip",      "Im out"),
                inputText("b3[out]:skip", "Im out"),
            ]);
            obj = serializeJSON(formElement);
            expect(obj).toEqual({b1: "Im in"});
        });
        it("raises an error if the obejct can not be parsed", function() {
            formElement = form([
                inputText("b1:object", "<NOT_A_JSON_OBJECT>"),
            ]);
            expect(function(){serializeJSON(formElement);}).toThrow();
        });
    });
    describe("invalid types", function() {
        it("raises an error if the type is not known", function() {
            formElement = form([
                inputText("b1:kaka", "not a valid type"),
            ]);
            expect(function(){ serializeJSON(formElement); })
                .toThrow(new Error("serializeJSON ERROR: Invalid type kaka found in input name 'b1:kaka', please use one of string, number, boolean, null, array, object, skip"));
        });
    });
    describe("form with multiple types", function() {
        it("parses every type as expected", function() { // EXAMPLE from the README file
            formElement = form([
                inputText("notype",           "default type is :string"),
                inputText("string:string",    ":string type overrides parsing options"),
                inputText("excludes:skip",    "Use :skip to not include this field in the result"),

                inputText("number[1]:number",           "1"),
                inputText("number[1.1]:number",         "1.1"),
                inputText("number[other stuff]:number", "other stuff"),

                inputText("boolean[true]:boolean",      "true"),
                inputText("boolean[false]:boolean",     "false"),
                inputText("boolean[0]:boolean",         "0"),

                inputText("null[null]:null",            "null"),
                inputText("null[other stuff]:null",     "other stuff"),

                inputText("array[empty]:array",         "[]"),
                inputText("array[not empty]:array",     "[1, 2, 3]"),

                inputText("object[empty]:object",       "{}"),
                inputText("object[not empty]:object",   "{\"my\": \"stuff\"}"),
            ]);

            obj = serializeJSON(formElement);
            expect(obj).toEqual({
                "notype": "default type is :string",
                "string": ":string type overrides parsing options",
                // :skip type removes the field from the output
                "number": {
                    "1": 1,
                    "1.1": 1.1,
                    "other stuff": NaN, // <-- Other stuff parses as NaN (Not a Number)
                },
                "boolean": {
                    "true": true,
                    "false": false,
                    "0": false, // <-- "false", "null", "undefined", "", "0" parse as false
                },
                "null": {
                    "null": null, // <-- "false", "null", "undefined", "", "0" parse as null
                    "other stuff": "other stuff"
                },
                "array": { // <-- works using JSON.parse
                    "empty": [],
                    "not empty": [1,2,3]
                },
                "object": { // <-- works using JSON.parse
                    "empty": {},
                    "not empty": {"my": "stuff"}
                }
            });
        });
    });

    describe("data-value-type attribute", function() {
        it("should set type and have precedence over the :type suffix", function() {
            const options = [
                selectOption("1"),
                selectOption("2"),
            ];
            options[1].selected = true;
            const inputs = [
                inputText("fooData", "0"),
                inputText("fooDataWithBrackets[kokoszka]", "0"),
                inputText("fooDataWithBrackets[kokoszka i cos innego]", "0"),
                inputText("foo:alwaysBoo", "string from data attr"),
                inputText("override::string", "boolean prevails"),
                inputText("notype", "default type is :string"),
                inputText("excludes", "Use :skip to not include this field in the result"),
                inputText("numberData", "1"),
                inputText("numberData[A]", "1"),
                inputText("numberData[B][C]", "2"),
                inputText("numberData[D][E][F]", "3"),
                inputText("number", "1"),
                inputSelect("selectNumber", options),
            ];
            inputs[0].setAttribute("data-value-type", "alwaysBoo");
            inputs[1].setAttribute("data-value-type", "alwaysBoo");
            inputs[2].setAttribute("data-value-type", "alwaysBoo");
            inputs[3].setAttribute("data-value-type", "string");
            inputs[4].setAttribute("data-value-type", "boolean");
            inputs[6].setAttribute("data-value-type", "skip");
            inputs[7].setAttribute("data-value-type", "number");
            inputs[8].setAttribute("data-value-type", "number");
            inputs[9].setAttribute("data-value-type", "number");
            inputs[10].setAttribute("data-value-type", "number");
            inputs[11].setAttribute("data-value-type", "number");
            inputs[12].setAttribute("data-value-type", "number");

            formElement = form(inputs);

            obj = serializeJSON(formElement, {
                customTypes: {
                    alwaysBoo: function() { return "Boo"; }
                }
            });

            expect(obj).toEqual({
                "fooDataWithBrackets": {
                    kokoszka: "Boo",
                    "kokoszka i cos innego": "Boo"
                },
                "fooData": "Boo",
                "foo:alwaysBoo": "string from data attr",
                "override::string": true,
                "notype": "default type is :string",
                // excludes was excluded because of type "skip"
                "numberData": { A: 1, B: { C: 2 }, D: { E: { F: 3 } } },
                "number": 1,
                "selectNumber": 2
            });
        });

        it("also works for matched inputs (not just forms) if they have the data-value-type attribute", function() {
            const inputs = generateHTML(
                "<input type=\"text\" name=\"fooData\" data-value-type=\"alwaysBoo\"   value=\"0\"/>" +
                "<input type=\"text\" name=\"foo:alwaysBoo\" data-value-type=\"string\"   value=\"0\"/>" +
                "<input type=\"text\" name=\"notype\" value=\"default type is :string\"/>" +
                "<input type=\"text\" name=\"number\" data-value-type=\"number\"   value=\"1\"/>"
            , true);

            obj = serializeJSON(inputs, {
                customTypes: {
                    alwaysBoo: function() { return "Boo"; }
                }
            });
            expect(obj).toEqual({
                "fooData": "Boo",
                "foo:alwaysBoo": "0",
                "notype": "default type is :string",
                "number": 1
            });
        });
    });

    describe("data-skip-falsy attribute", function() {
        it("allows to skip faily fields, just like with the option skipFalsyValuesForFields", function() {
            const inputs = [
                inputText("skipFalsyZero:number",    "0"    ),
                inputText("skipFalsyFalse:boolean",  "false"),
                inputText("skipFalsyNull:null",      "null" ),
                inputText("skipFalsyEmpty:string",   ""     ),
                inputText("skipFalsyFoo:string",     "foo"  ),
                inputText("zero:number",  "0"),
                inputText("foo:string",   "foo"),
                inputText("empty:string", ""),
            ];
            inputs[0].setAttribute("data-skip-falsy", "true");
            inputs[1].setAttribute("data-skip-falsy", "true");
            inputs[2].setAttribute("data-skip-falsy", "true");
            inputs[3].setAttribute("data-skip-falsy", "true");
            inputs[4].setAttribute("data-skip-falsy", "true");
            var form2 = form(inputs);

            obj = serializeJSON(form2);
            expect(obj["skipFalsyZero"]).toEqual(undefined);  // skip
            expect(obj["skipFalsyFalse"]).toEqual(undefined); // skip
            expect(obj["skipFalsyNull"]).toEqual(undefined);  // skip
            expect(obj["skipFalsyEmpty"]).toEqual(undefined); // skip
            expect(obj["skipFalsyFoo"]).toEqual("foo");
            expect(obj["zero"]).toEqual(0);
            expect(obj["foo"]).toEqual("foo");
            expect(obj["empty"]).toEqual("");
        });

        it("overrides the option skipFalsyValuesForFields", function() {
            const inputs = [
                inputText("skipFalsyZero:number",    "0"    ),
                inputText("skipFalsyFalse:boolean",  "false"),
                inputText("skipFalsyNull:null",      "null" ),
                inputText("skipFalsyEmpty:string",   ""     ),
                inputText("skipFalsyFoo:string",     "foo"  ),
                inputText("zero:number",  "0"),
                inputText("empty:string", ""),
            ];
            inputs[0].setAttribute("data-skip-falsy", "true");
            inputs[1].setAttribute("data-skip-falsy", "false");
            inputs[2].setAttribute("data-skip-falsy", "false");
            inputs[3].setAttribute("data-skip-falsy", "true");
            inputs[4].setAttribute("data-skip-falsy", "true");
            var form2 = form(inputs);

            obj = serializeJSON(form2, { skipFalsyValuesForFields: [ // using skipFalsyValuesForFields option
                "skipFalsyZero",
                "skipFalsyFalse",
                "skipFalsyNull",
                "zero"
            ]});
            expect(obj["skipFalsyZero"]).toEqual(undefined);  // skip from attr and opt
            expect(obj["skipFalsyFalse"]).toEqual(false); // not skip (attr override)
            expect(obj["skipFalsyNull"]).toEqual(null);  // not skip (attr override)
            expect(obj["skipFalsyEmpty"]).toEqual(undefined); // skip from attr
            expect(obj["skipFalsyFoo"]).toEqual("foo");
            expect(obj["zero"]).toEqual(undefined); // skip from opt
            expect(obj["empty"]).toEqual("");
        });

        it("overrides the option skipFalsyValuesForTypes", function() {
            const inputs = [
                inputText("skipFalsyZero:number",    "0"    ),
                inputText("skipFalsyFalse:boolean",  "false"),
                inputText("skipFalsyNull:null",      "null" ),
                inputText("skipFalsyEmpty:string",   ""     ),
                inputText("skipFalsyFoo:string",     "foo"  ),
                inputText("zero:number",  "0"),
                inputText("empty:string", ""),
                inputText("null:null",    "null"),
            ];
            inputs[0].setAttribute("data-skip-falsy", "true");
            inputs[1].setAttribute("data-skip-falsy", "false");
            inputs[2].setAttribute("data-skip-falsy", "false");
            inputs[3].setAttribute("data-skip-falsy", "true");
            inputs[4].setAttribute("data-skip-falsy", "true");
            var form2 = form(inputs);

            obj = serializeJSON(form2, { skipFalsyValuesForTypes: [ // using skipFalsyValuesForFields option
                "number",
                "boolean",
                "null"
            ]});
            expect(obj["skipFalsyZero"]).toEqual(undefined);  // skip from attr and opt
            expect(obj["skipFalsyFalse"]).toEqual(false); // not skip (attr override)
            expect(obj["skipFalsyNull"]).toEqual(null);  // not skip (attr override)
            expect(obj["skipFalsyEmpty"]).toEqual(undefined); // skip from attr
            expect(obj["skipFalsyFoo"]).toEqual("foo");
            expect(obj["zero"]).toEqual(undefined); // skip from opt
            expect(obj["empty"]).toEqual("");
            expect(obj["null"]).toEqual(undefined); // skip from opt
        });
    });

    // options
    describe("options", function() {
        var formElement;
        beforeEach(function() {
            formElement = form([
                inputText("Numeric 0",     "0"),
                inputText("Numeric 1",     "1"),
                inputText("Numeric 2.2",   "2.2"),
                inputText("Numeric -2.25", "-2.25"),
                inputText("Bool true",     "true"),
                inputText("Bool false",    "false"),
                inputText("Null",          "null"),
                inputText("String",        "text is always string"),
                inputText("Empty",         ""),
            ]);
        });

        it("with no options returns strings by default", function() {
            obj = serializeJSON(formElement, {}); // empty object should be translated to default options
            expect(obj).toEqual({
                "Numeric 0":     "0",
                "Numeric 1":     "1",
                "Numeric 2.2":   "2.2",
                "Numeric -2.25": "-2.25",
                "Bool true":     "true",
                "Bool false":    "false",
                "Null":          "null",
                "String":        "text is always string",
                "Empty":         ""
            });
        });

        it("raises a descriptive error if the option is invalid", function() {
            expect(function(){ serializeJSON(formElement, {invalidOption: true}); })
                .toThrow(new Error("serializeJSON ERROR: invalid option 'invalidOption'. Please use one of checkboxUncheckedValue, useIntKeysAsArrayIndex, skipFalsyValuesForTypes, skipFalsyValuesForFields, disableColonTypes, customTypes, defaultTypes, defaultType"));
        });

        describe("skipFalsyValuesForFields", function() {
            it("skips serialization of falsy values but only on inputs with given names", function() {
                obj = serializeJSON(formElement, {skipFalsyValuesForFields: ["Empty", "Null", "Numeric 0", "String"]});
                expect(obj).toEqual({
                    "Numeric 0":     "0", // "0" as :string is not falsy
                    "Numeric 1":     "1",
                    "Numeric 2.2":   "2.2",
                    "Numeric -2.25": "-2.25",
                    "Bool true":     "true",
                    "Bool false":    "false",
                    "Null":          "null", // "null" as :string is not falsy
                    "String":        "text is always string"
                    // "Empty" skip
                });
            });
        });

        describe("skipFalsyValuesForTypes", function() {
            it("skips serialization of falsy values for on inputs of the given types", function() {
                const inputs = [
                    inputText("Num0:number",         "0"),
                    inputText("Num1:number",         "1"),
                    inputText("NaN:number",          "wololoo"),
                    inputText("Num0attr",            "0"),
                    inputText("Num1attr",            "1"),
                    inputText("Bool true:boolean",   "true"),
                    inputText("Bool false:boolean",  "false"),
                    inputText("Text:string",         "text is always string"),
                    inputText("Empty String:string", ""),
                    inputText("Empty Implicit",      ""), // :string type is implicit
                    inputText("Array:array",         "[1, 2]"),
                    inputText("Empty Array:array",   "[]"),
                    inputText("Null:null",           "null"),
                ];
                inputs[3].setAttribute("data-value-type", "number");
                inputs[4].setAttribute("data-value-type", "number");
                var form2 = form(inputs);

                obj = serializeJSON(form2, {skipFalsyValuesForTypes: ["number", "boolean", "string", "array", "null"]});
                expect(obj["Num0"]).toEqual(undefined); // skip
                expect(obj["Num1"]).toEqual(1);
                expect(obj["NaN"]).toEqual(undefined); // skip
                expect(obj["Num0attr"]).toEqual(undefined); // skip
                expect(obj["Num1attr"]).toEqual(1);
                expect(obj["Bool true"]).toEqual(true);
                expect(obj["Bool false"]).toEqual(undefined); // skip
                expect(obj["Text"]).toEqual("text is always string");
                expect(obj["Empty String"]).toEqual(undefined);
                expect(obj["Empty Implicit"]).toEqual(undefined);
                expect(obj["Array"]).toEqual([1, 2]);
                expect(obj["Empty Array"]).toEqual([]); // Not skip! empty arrays are not falsy
                expect(obj["Null"]).toEqual(undefined); // skip

                obj = serializeJSON(form2, {skipFalsyValuesForTypes: ["number"]}); // skip only falsy numbers
                expect(obj["Num0"]).toEqual(undefined); // skip
                expect(obj["Num1"]).toEqual(1);
                expect(obj["NaN"]).toEqual(undefined); // skip
                expect(obj["Num0attr"]).toEqual(undefined); // skip
                expect(obj["Num1attr"]).toEqual(1);
                expect(obj["Bool true"]).toEqual(true);
                expect(obj["Bool false"]).toEqual(false);
                expect(obj["Text"]).toEqual("text is always string");
                expect(obj["Empty String"]).toEqual("");
                expect(obj["Empty Implicit"]).toEqual("");
                expect(obj["Array"]).toEqual([1, 2]);
                expect(obj["Empty Array"]).toEqual([]);
                expect(obj["Null"]).toEqual(null);
            });
        });

        describe("checkboxUncheckedValue", function() {
            it("uses that value for unchecked checkboxes", function() {
                const inputs = [
                    inputCheckbox("check1", "yes"),
                    inputCheckbox("check2", "yes"),
                    inputCheckbox("check3", "yes"),
                ];
                inputs[2].checked = true;
                formElement = form(inputs);

                obj = serializeJSON(formElement, {checkboxUncheckedValue: "NOPE"});
                expect(obj).toEqual({check1: "NOPE", check2: "NOPE", check3: "yes"});
            });

            it("is overriden by data-unchecked-value attribute", function() {
                const inputs = [
                    inputCheckbox("check1", "yes"),
                    inputCheckbox("check2", "yes"),
                    inputCheckbox("check3", "yes"),
                ];
                inputs[1].setAttribute("data-unchecked-value", "OVERRIDE");
                inputs[2].checked = true;
                formElement = form(inputs);

                obj = serializeJSON(formElement, {checkboxUncheckedValue: "NOPE"});
                expect(obj).toEqual({check1: "NOPE", check2: "OVERRIDE", check3: "yes"});
            });

            it("works on a list of checkboxes", function() {
                formElement = document.createElement('form');
                formElement.innerHTML = "<label class=\"checkbox-inline\">" +
                "  <input type=\"checkbox\" name=\"flags[]\" value=\"input1\"> Input 1" +
                "</label>" +
                "<label class=\"checkbox-inline\">" +
                "  <input type=\"checkbox\" name=\"flags[]\" value=\"input2\"> Input 2" +
                "</label>";

                obj = serializeJSON(formElement, {checkboxUncheckedValue: "false"});
                expect(obj).toEqual({
                    "flags": ["false", "false"]
                });

                formElement.querySelector("input[value=\"input1\"]").checked = true;
                obj = serializeJSON(formElement, {checkboxUncheckedValue: "false"});
                expect(obj).toEqual({
                    "flags": ["input1", "false"]
                });
            });

            it("works on a nested list of checkboxes", function() {
                const inputs = [
                    inputText("form[title]",   "list of checkboxes"),
                    inputCheckbox("form[check][]", "true"),
                    inputCheckbox("form[check][]", "true"),
                    inputCheckbox("form[check][]", "true"),
                ];
                inputs[1].checked = true;
                inputs[3].setAttribute("data-unchecked-value" ,"NOPE");
                formElement = form(inputs);
                obj = serializeJSON(formElement, {checkboxUncheckedValue: "false"});
                expect(obj).toEqual({
                    form: {
                        title: "list of checkboxes",
                        check: ["true", "false", "NOPE"]
                    }
                });
            });

            it("works on a nested list of objects", function() {
                const inputs = [
                    inputCheckbox("answers[][correct]:boolean", "true"),
                    inputText("answers[][text]", "Blue"),

                    inputCheckbox("answers[][correct]:boolean", "true"),
                    inputText("answers[][text]", "Green"),

                    inputCheckbox("answers[][correct]:boolean", "true"),
                    inputText("answers[][text]", "Red"),
                ];
                inputs[0].setAttribute("data-unchecked-value", "false");
                inputs[2].setAttribute("data-unchecked-value", "false");
                inputs[4].setAttribute("data-unchecked-value", "false");
                inputs[4].checked = true;

                formElement = form(inputs);
                obj = serializeJSON(formElement, {checkboxUncheckedValue: "false"});
                expect(obj).toEqual({
                    answers: [
                        {correct: false, text: "Blue"},
                        {correct: false, text: "Green"},
                        {correct: true, text: "Red"},
                    ],
                });
            });

            it("does not serialize disabled checkboxes", function() {
                const inputs = [
                    inputCheckbox("checkDisabled1", "true"),
                    inputCheckbox("checkDisabled2", "true"),
                ];
                inputs[0].disabled = true;
                inputs[1].disabled = true;
                inputs[1].setAttribute("data-unchecked-value", "NOPE");
                formElement = form(inputs);
                obj = serializeJSON(formElement, {checkboxUncheckedValue: "false"});
                expect(obj).toEqual({});
            });
        });

        describe("useIntKeysAsArrayIndex", function() {
            it("uses int keys as array indexes instead of object properties", function() {
                formElement = form([
                    inputText("foo[0]", "0"),
                    inputText("foo[1]", "1"),
                    inputText("foo[5]", "5"),
                ]);

                obj = serializeJSON(formElement, {useIntKeysAsArrayIndex: false}); // default
                expect(obj).toEqual({"foo": {"0": "0", "1": "1", "5": "5"}});

                obj = serializeJSON(formElement, {useIntKeysAsArrayIndex: true}); // with option useIntKeysAsArrayIndex true
                expect(obj).toEqual({"foo": ["0", "1", undefined, undefined, undefined, "5"]});
            });

            it("works with nested arrays", function() {
                formElement = form([
                    inputText("foo[0][bar][0]", "foo0bar0"),
                    inputText("foo[1][bar][0]", "foo1bar0"),
                    inputText("foo[1][bar][1]", "foo1bar1"),
                ]);

                obj = serializeJSON(formElement, {useIntKeysAsArrayIndex: true});
                expect(obj).toEqual({"foo": [
                    {"bar": ["foo0bar0"]},
                    {"bar": ["foo1bar0", "foo1bar1"]},
                ]});
            });

            it("does not get confused by attribute names that are similar to integers, but not valid array indexes", function() { // only integers are mapped to an array
                formElement = form([
                    inputText("drinks[1st]", "coffee"),
                    inputText("drinks[2nd]", "beer"),
                ]);

                obj = serializeJSON(formElement, {useIntKeysAsArrayIndex: true});
                expect(obj).toEqual({ drinks: {"1st": "coffee", "2nd": "beer"} });
            });

            it("regresion for github issue #69", function() {
                const input = document.createElement('input');
                input.name = 'array[0][value]';
                input.value = 'value';
                formElement = form([
                    input
                ]);
                obj = serializeJSON(formElement, {useIntKeysAsArrayIndex: true});
                expect(obj).toEqual({"array": [{"value": "value"}]});
            });
        });

        describe("customTypes", function() {
            it("serializes value according to custom function without disturbing default types", function() {
                formElement = form([
                    inputText("foo:alwaysBoo",   "0"),

                    inputText("notype",           "default type is :string"),
                    inputText("string:string",    ":string type overrides parsing options"),
                    inputText("excludes:skip",    "Use :skip to not include this field in the result"),

                    inputText("number[1]:number",           "1"),
                    inputText("number[1.1]:number",         "1.1"),
                    inputText("number[other stuff]:number", "other stuff"),

                    inputText("boolean[true]:boolean",      "true"),
                    inputText("boolean[false]:boolean",     "false"),
                    inputText("boolean[0]:boolean",         "0"),

                    inputText("null[null]:null",            "null"),
                    inputText("null[other stuff]:null",     "other stuff"),

                    inputText("array[empty]:array",         "[]"),
                    inputText("array[not empty]:array",     "[1, 2, 3]"),

                    inputText("object[empty]:object",       "{}"),
                    inputText("object[not empty]:object",   "{\"my\": \"stuff\"}"),
                ]);

                obj = serializeJSON(formElement, {
                    customTypes: {
                        alwaysBoo: function() { return "Boo"; }
                    }
                });

                expect(obj).toEqual({
                    "foo": "Boo",

                    "notype": "default type is :string",
                    "string": ":string type overrides parsing options",
                    // :skip type removes the field from the output
                    "number": {
                        "1": 1,
                        "1.1": 1.1,
                        "other stuff": NaN, // <-- Other stuff parses as NaN (Not a Number)
                    },
                    "boolean": {
                        "true": true,
                        "false": false,
                        "0": false, // <-- "false", "null", "undefined", "", "0" parse as false
                    },
                    "null": {
                        "null": null, // <-- "false", "null", "undefined", "", "0" parse as null
                        "other stuff": "other stuff"
                    },
                    "array": { // <-- works using JSON.parse
                        "empty": [],
                        "not empty": [1,2,3]
                    },
                    "object": { // <-- works using JSON.parse
                        "empty": {},
                        "not empty": {"my": "stuff"}
                    }
                });
            });

            it("type functions receive the value and the DOM element of the field that is being parsed", function() {
                const inputs = [
                    inputText("foo1:withXoxo", "luv"),
                    inputText("foo2:withXoxo", "luv"),
                    inputText("foo3:multiply", "3"),
                ];
                inputs[1].setAttribute("data-Xoxo", "CustomPassedXoxo");
                inputs[2].setAttribute("data-multiply", "5");
                formElement = form(inputs);
                obj = serializeJSON(formElement, {
                    customTypes: {
                        withXoxo: function(val, el) {
                            var xoxo = el.getAttribute("data-Xoxo") || "Xoxo";
                            return val + xoxo;
                        },
                        multiply: function(val, el) {
                            var mult = el.getAttribute("data-multiply");
                            return Number(val) * Number(mult);
                        },
                    }
                });
                expect(obj).toEqual({
                    "foo1": "luvXoxo",
                    "foo2": "luvCustomPassedXoxo",
                    "foo3": 15 // 3 * 5
                });
            });

            it("overrides defaultTypes", function() {
                formElement = form([
                    inputText("incremented:number", "0"),
                ]);
                obj = serializeJSON(formElement, {
                    customTypes: {
                        number: function(str) { return Number(str) + 1; }
                    }
                });
                expect(obj).toEqual({ "incremented": 1 });
            });

            it("overrides defaultTypes even if they are re-defined", function() {
                formElement = form([
                    inputText("num:number", "0"),
                ]);

                obj = serializeJSON(formElement, {
                    defaultTypes: {
                        number: function() { return 1; }
                    }
                });
                expect(obj).toEqual({ "num": 1 });

                obj = serializeJSON(formElement, {
                    defaultTypes: {
                        number: function() { return 1; }
                    },
                    customTypes: {
                        number: function() { return 22; }
                    }
                });
                expect(obj).toEqual({ "num": 22 });
            });
        });

        it("can override :string type to change the default parsing function", function() {
            formElement = form([
                inputText("foo", "var"),
                inputText("empty", ""),
            ]);

            // default
            obj = serializeJSON(formElement);
            expect(obj).toEqual({ "foo": "var", "empty": ""});

            // with custom :string type function
            obj = serializeJSON(formElement, {
                customTypes: {
                    string: function(str) { return str || null; }
                }
            });
            expect(obj).toEqual({ "foo": "var", "empty": null});
        });

        describe("defaultType", function() {
            it("uses the specified type as default if no other type is defined", function() {
                const inputs = [
                    inputText("notype",         "0"),
                    inputText("foo:alwaysBoo",  "0"),
                    inputText("string:string",  ":string overrides default option"),
                    inputText("excludes:skip",  "Use :skip to not include this field in the result"),
                    inputText("fooData",        "0"),
                    inputText("foostr::kaka",   "string from data attr"),
                ];
                inputs[4].setAttribute("data-value-type", "alwaysBoo");
                inputs[5].setAttribute("data-value-type", "string");
                formElement = form(inputs);

                obj = serializeJSON(formElement, {
                    defaultType: "number",
                    customTypes: {
                        alwaysBoo: function() { return "Boo"; }
                    }
                });

                expect(obj).toEqual({
                    "notype": 0, // parsed with "number", used as default type
                    "foo": "Boo",
                    "string": ":string overrides default option",
                    // :skip type removes the field from the output
                    "fooData": "Boo",
                    "foostr::kaka": "string from data attr"
                });
            });

            it("can be specified to be a custom type function", function() {
                formElement = form([
                    inputText("notype",           "0"),
                    inputText("string:string",    ":string overrides default option"),
                ]);

                obj = serializeJSON(formElement, {
                    defaultType: "alwaysBoo",
                    customTypes: {
                        alwaysBoo: function() { return "Boo"; }
                    }
                });
                expect(obj).toEqual({
                    "notype": "Boo", // parsed with "alwaysBoo", used as default type
                    "string": ":string overrides default option",
                });
            });

            it("raises an error if the type function is not specified", function() {
                formElement = form([
                    inputText("fookey", "fooval"),
                ]);
                expect(function(){
                    serializeJSON(formElement, { defaultType: "not_a_valid_type" });
                }).toThrow(new Error("serializeJSON ERROR: Invalid type not_a_valid_type found in input name 'fookey', please use one of string, number, boolean, null, array, object, skip"));
            });
        });


        describe("disableColonTypes", function() {
            it("ignores type suffixes from input names", function() {
                formElement = form([
                    inputText("foo",              "bar"),
                    inputText("notype::foobar",   "foobar"),
                    inputText("string:string",    "keeps full input name"),
                    inputText("excludes:skip",    "not skip because is not parsed as a type"),
                ]);

                obj = serializeJSON(formElement, { disableColonTypes: true });
                expect(obj).toEqual({
                    "foo": "bar", // nothing special over here
                    "notype::foobar": "foobar", // colons are no special now
                    "string:string": "keeps full input name",
                    "excludes:skip": "not skip because is not parsed as a type"
                });
            });
            it("still respects default type function and data-value-type attributes if specified", function() {
                const inputs = [
                    inputText("notype",           "0"),
                    inputText("foo:alwaysBoo",    "0"),
                    inputText("string:string",    "99"),
                    inputText("excludes:skip",    "666"),
                    inputText("fooData",          "0"),
                    inputText("foostr::kaka",     "string from data attr"),
                ];
                inputs[4].setAttribute("data-value-type", "alwaysBoo");
                inputs[5].setAttribute("data-value-type", "string");
                formElement = form(inputs);

                obj = serializeJSON(formElement, {
                    disableColonTypes: true,
                    defaultType: "number",
                    customTypes: {
                        alwaysBoo: function() { return "Boo"; }
                    }
                });
                expect(obj).toEqual({
                    "notype": 0, // parsed with "number", used as default type
                    "foo:alwaysBoo": 0,
                    "string:string": 99,
                    "excludes:skip": 666,

                    "fooData": "Boo", // data-value-type still works to define other types
                    "foostr::kaka": "string from data attr"
                });
            });
        });

        describe("with defaultOptions", function() {
            var defaults = defaultOptions;
            afterEach(function() {
                setDefaultOptions(defaults); // restore defaults
            });

            it("can be overriden with different options", function() {
                formElement = form([
                    inputText("num0:number", "0"),
                    inputText("num1:number", "1"),
                    inputText("empty", ""),
                ]);

                setDefaultOptions({skipFalsyValuesForFields: ["num0", "num1", "empty"]});
                obj = serializeJSON(formElement);
                expect(obj).toEqual({
                    // "num0":  0, // skip
                    "num1":     1, // not skip because it is not falsy
                    // "empty": "" // skip,
                });

                obj = serializeJSON(formElement, {skipFalsyValuesForFields: ["num0"]});
                expect(obj).toEqual({
                    // "num0": 0, // skip
                    "num1":    1, // not skip because it is not falsy
                    "empty":   "" // not skip because the default option was override
                });
            });

            it("allows to set default for checkboxUncheckedValue", function() {
                const inputs = [
                    inputCheckbox("check1", "true"),
                    inputCheckbox("check2", "true"),
                    inputCheckbox("check3", "true"),
                ];
                inputs[0].checked = true;
                inputs[2].setAttribute("data-unchecked-value", "unchecked_from_data_attr");
                formElement = form(inputs);

                setDefaultOptions({checkboxUncheckedValue: "unchecked_from_defaults"});
                obj = serializeJSON(formElement); // with defaults
                expect(obj).toEqual({
                    "check1": "true",
                    "check2": "unchecked_from_defaults",
                    "check3": "unchecked_from_data_attr"
                });

                obj = serializeJSON(formElement, {checkboxUncheckedValue: "unchecked_from_option"}); // override defaults
                expect(obj).toEqual({
                    "check1": "true",
                    "check2": "unchecked_from_option",
                    "check3": "unchecked_from_data_attr"
                });
            });
        });
    });
});

// splitType
describe("splitType", function() {
    it("returns an object with type and nameWithNoType properties form the name with :type colon notation", function() {
        expect(splitType("foo")).toEqual(["foo", ""]);
        expect(splitType("foo:boolean")).toEqual(["foo", "boolean"]);
        expect(splitType("foo[bar]:null")).toEqual(["foo[bar]", "null"]);
        expect(splitType("foo[my::key]:string")).toEqual(["foo[my::key]", "string"]);
    });
});

// splitInputNameIntoKeysArray
describe("splitInputNameIntoKeysArray", function() {
    it("accepts a simple name", function() {
        expect(splitInputNameIntoKeysArray("foo")).toEqual(["foo"]);
    });
    it("accepts a name wrapped in brackets", function() {
        expect(splitInputNameIntoKeysArray("[foo]")).toEqual(["foo"]);
    });
    it("accepts names separated by brackets", function() {
        expect(splitInputNameIntoKeysArray("foo[inn][bar]")).toEqual(["foo", "inn", "bar"]);
        expect(splitInputNameIntoKeysArray("foo[inn][bar][0]")).toEqual(["foo", "inn", "bar", "0"]);
    });
    it("accepts empty brakets as empty strings", function() {
        expect(splitInputNameIntoKeysArray("arr[][bar]")).toEqual(["arr", "", "bar"]);
        expect(splitInputNameIntoKeysArray("arr[][][bar]")).toEqual(["arr", "", "", "bar"]);
        expect(splitInputNameIntoKeysArray("arr[][bar][]")).toEqual(["arr", "", "bar", ""]);
    });
    it("accepts nested brackets", function() {
        expect(splitInputNameIntoKeysArray("foo[inn[bar]]")).toEqual(["foo", "inn", "bar"]);
        expect(splitInputNameIntoKeysArray("foo[inn[bar[0]]]")).toEqual(["foo", "inn", "bar", "0"]);
        expect(splitInputNameIntoKeysArray("[foo[inn[bar[0]]]]")).toEqual(["foo", "inn", "bar", "0"]);
        expect(splitInputNameIntoKeysArray("foo[arr[]]")).toEqual(["foo", "arr", ""]);
        expect(splitInputNameIntoKeysArray("foo[bar[arr[]]]")).toEqual(["foo", "bar", "arr", ""]);
    });
});

// deepSet
// Assigns nested keys like "address[state][abbr]" to an object
describe("deepSet", function() {
    var arr, obj, v, v2;

    beforeEach(function() {
        obj = {};
        arr = [];
        v = "v";
        v2 = "v2";
    });

    it("simple attr ['foo']", function() {
        deepSet(obj, ["foo"], v);
        expect(obj).toEqual({foo: v});
    });

    it("simple attr ['foo'] twice should set the last value", function() {
        deepSet(obj, ["foo"], v);
        deepSet(obj, ["foo"], v2);
        expect(obj).toEqual({foo: v2});
    });

    it("nested attr ['inn', 'foo']", function() {
        deepSet(obj, ["inn", "foo"], v);
        expect(obj).toEqual({inn: {foo: v}});
    });

    it("nested attr ['inn', 'foo'] twice should set the last value", function() {
        deepSet(obj, ["inn", "foo"], v);
        deepSet(obj, ["inn", "foo"], v2);
        expect(obj).toEqual({inn: {foo: v2}});
    });

    it("multiple assign attr ['foo'] and ['inn', 'foo']", function() {
        deepSet(obj, ["foo"], v);
        deepSet(obj, ["inn", "foo"], v);
        expect(obj).toEqual({foo: v, inn: {foo: v}});
    });

    it("very nested attr ['inn', 'inn', 'inn', 'foo']", function() {
        deepSet(obj, ["inn", "inn", "inn", "foo"], v);
        expect(obj).toEqual({inn: {inn: {inn: {foo: v}}}});
    });

    it("array push with empty index, if repeat same object element key then it creates a new element", function() {
        deepSet(arr, [""], v);        //=> arr === [v]
        deepSet(arr, ["", "foo"], v); //=> arr === [v, {foo: v}]
        deepSet(arr, ["", "bar"], v); //=> arr === [v, {foo: v, bar: v}]
        deepSet(arr, ["", "bar"], v); //=> arr === [v, {foo: v, bar: v}, {bar: v}]
        expect(arr).toEqual([v, {foo: v, bar: v}, {bar: v}]);
    });

    it("array push with empty index and empty value, also creates a new element", function() {
        deepSet(arr, ["", "foo"], ""); //=> arr === [{foo: ''}]
        deepSet(arr, ["", "foo"], ""); //=> arr === [{foo: ''}, {foo: ''}, {foo: v}]
        deepSet(arr, ["", "foo"], v);  //=> arr === [{foo: ''}, {foo: ''}, {foo: v}]
        deepSet(arr, ["", "foo"], ""); //=> arr === [{foo: ''}, {foo: ''}, {foo: v}, {foo: ''}]
        expect(arr).toEqual([{foo: ""}, {foo: ""}, {foo: v}, {foo: ""}]);
    });

    it("array assign with empty index should push the element", function() {
        deepSet(arr, [""], 1);
        deepSet(arr, [""], 2);
        deepSet(arr, [""], 3);
        expect(arr).toEqual([1,2,3]);
    });

    it("nested array assign with empty index should push the element", function() {
        deepSet(obj, ["arr", ""], 1);
        deepSet(obj, ["arr", ""], 2);
        deepSet(obj, ["arr", ""], 3);
        expect(obj).toEqual({arr: [1,2,3]});
    });

    it("nested arrays with empty indexes should push the elements to the most deep array", function() {
        deepSet(arr, ["", "", ""], 1);
        deepSet(arr, ["", "", ""], 2);
        deepSet(arr, ["", "", ""], 3);
        expect(arr).toEqual([[[1, 2, 3]]]);
    });

    it("nested arrays with nested objects shuold push new objects only when the nested key already exists", function() {
        deepSet(arr, ["", "name", "first"], "Bruce");
        expect(arr).toEqual([
            {name: {first: "Bruce"}}
        ]);
        deepSet(arr, ["", "name", "last"], "Lee");
        expect(arr).toEqual([
            {name: {first: "Bruce", last: "Lee"}}
        ]);
        deepSet(arr, ["", "age"], 33);
        expect(arr).toEqual([
            {name: {first: "Bruce", last: "Lee"}, age: 33}
        ]);

        deepSet(arr, ["", "name", "first"], "Morihei");
        expect(arr).toEqual([
            {name: {first: "Bruce", last: "Lee"}, age: 33},
            {name: {first: "Morihei"}}
        ]);
        deepSet(arr, ["", "name", "last"], "Ueshiba");
        expect(arr).toEqual([
            {name: {first: "Bruce", last: "Lee"}, age: 33},
            {name: {first: "Morihei", last: "Ueshiba"}}
        ]);
        deepSet(arr, ["", "age"], 86);
        expect(arr).toEqual([
            {name: {first: "Bruce", last: "Lee"}, age: 33},
            {name: {first: "Morihei", last: "Ueshiba"}, age: 86}
        ]);
    });

    describe("with useIntKeysAsArrayIndex option", function(){
        var intIndx = {useIntKeysAsArrayIndex: true};

        it("simple array ['0']", function() {
            arr = [];
            deepSet(arr, ["0"], v);
            expect(arr).toEqual([v]); // still sets the value in the array because the 1st argument is an array

            arr = [];
            deepSet(arr, ["0"], v, intIndx);
            expect(arr).toEqual([v]);
        });

        it("nested simple array ['arr', '0']", function() {
            obj = {};
            deepSet(obj, ["arr", "0"], v);
            expect(obj).toEqual({"arr": {"0": v}});

            obj = {};
            deepSet(obj, ["arr", "0"], v, intIndx);
            expect(obj).toEqual({"arr": [v]});
        });

        it("nested simple array multiple values", function() {
            obj = {};
            deepSet(obj, ["arr", "1"], v2);
            deepSet(obj, ["arr", "0"], v);
            expect(obj).toEqual({"arr": {"0": v, "1": v2}});

            obj = {};
            deepSet(obj, ["arr", "1"], v2, intIndx);
            deepSet(obj, ["arr", "0"], v, intIndx);
            expect(obj).toEqual({"arr": [v, v2]});
        });

        it("nested arrays with indexes should create a matrix", function() {
            arr = [];
            deepSet(arr, ["0", "0", "0"], 1);
            deepSet(arr, ["0", "0", "1"], 2);
            deepSet(arr, ["0", "1", "0"], 3);
            deepSet(arr, ["0", "1", "1"], 4);
            deepSet(arr, ["1", "0", "0"], 5);
            deepSet(arr, ["1", "0", "1"], 6);
            deepSet(arr, ["1", "1", "0"], 7);
            deepSet(arr, ["1", "1", "1"], 8);
            expect(arr).toEqual([{ "0": {"0": 1, "1": 2}, "1": {"0": 3, "1": 4}}, {"0": {"0": 5, "1": 6}, "1": {"0": 7, "1": 8}}]);

            arr = [];
            deepSet(arr, ["0", "0", "0"], 1, intIndx);
            deepSet(arr, ["0", "0", "1"], 2, intIndx);
            deepSet(arr, ["0", "1", "0"], 3, intIndx);
            deepSet(arr, ["0", "1", "1"], 4, intIndx);
            deepSet(arr, ["1", "0", "0"], 5, intIndx);
            deepSet(arr, ["1", "0", "1"], 6, intIndx);
            deepSet(arr, ["1", "1", "0"], 7, intIndx);
            deepSet(arr, ["1", "1", "1"], 8, intIndx);
            expect(arr).toEqual([[[1, 2], [3, 4]], [[5, 6], [7, 8]]]);
        });

        it("nested object as array element ['arr', '0', 'foo']", function() {
            obj = {};
            deepSet(obj, ["arr", "0", "foo"], v);
            expect(obj).toEqual({arr: {"0": {foo: v}}});

            obj = {};
            deepSet(obj, ["arr", "0", "foo"], v, intIndx);
            expect(obj).toEqual({arr: [{foo: v}]});
        });

        it("array of objects", function(){
            obj = {};
            deepSet(obj, ["arr", "0", "foo"], v);
            deepSet(obj, ["arr", "0", "bar"], v);
            deepSet(obj, ["arr", "1", "foo"], v2);
            deepSet(obj, ["arr", "1", "bar"], v2);
            expect(obj).toEqual({"arr": {"0": {foo: v, bar: v}, "1": {foo: v2, bar: v2}}});

            obj = {};
            deepSet(obj, ["arr", "0", "foo"], v, intIndx);
            deepSet(obj, ["arr", "0", "bar"], v, intIndx);
            deepSet(obj, ["arr", "1", "foo"], v2, intIndx);
            deepSet(obj, ["arr", "1", "bar"], v2, intIndx);
            expect(obj).toEqual({"arr": [{foo: v, bar: v}, {foo: v2, bar: v2}]});
        });

        it("nested arrays mixing empty indexes with numeric indexes should push when using empty but assign when using numeric", function() {
            obj = {};
            deepSet(obj, ["arr", "", "0", ""], 1);
            deepSet(obj, ["arr", "", "1", ""], 2);
            deepSet(obj, ["arr", "", "0", ""], 3);
            deepSet(obj, ["arr", "", "1", ""], 4);
            expect(obj).toEqual({"arr": [{"0": [1, 3], "1": [2, 4]}]});

            obj = {};
            deepSet(obj, ["arr", "", "0", ""], 1, intIndx);
            deepSet(obj, ["arr", "", "1", ""], 2, intIndx);
            deepSet(obj, ["arr", "", "0", ""], 3, intIndx);
            deepSet(obj, ["arr", "", "1", ""], 4, intIndx);
            expect(obj).toEqual({"arr": [[[1, 3], [2, 4]]]});
        });

        it("should set all different nested values", function() {
            deepSet(obj, ["foo"], v, intIndx);
            deepSet(obj, ["inn", "foo"], v, intIndx);
            deepSet(obj, ["inn", "arr", "0"], v, intIndx);
            deepSet(obj, ["inn", "arr", "1"], v2, intIndx);
            deepSet(obj, ["inn", "arr", "2", "foo"], v, intIndx);
            deepSet(obj, ["inn", "arr", "2", "bar"], v), intIndx;
            deepSet(obj, ["inn", "arr", ""], v, intIndx);
            deepSet(obj, ["inn", "arr", ""], v2, intIndx);
            deepSet(obj, ["inn", "arr", "", "foo"], v2, intIndx);
            deepSet(obj, ["inn", "arr", "", "bar"], v2, intIndx);
            deepSet(obj, ["inn", "arr", "2", "inn", "foo"], v, intIndx);
            expect(obj).toEqual({foo: v, inn: {foo: v, arr: [v, v2, {foo: v, bar: v, inn: {foo: v}}, v, v2, {foo: v2, bar: v2}]}});
        });
    });
});


// Test helpers

function form(inputs) {
    return withAppended(document.createElement('form'), inputs);
}

function withAppended(el, innerEls) {
    innerEls.forEach(function(nestedEl){
        el.append(nestedEl);
    });
    return el;
}

function inputText(name, value) {
    const input = document.createElement('input');
    input.type = 'text';
    input.name = name;
    input.value = value;
    return input;
}

function inputHidden(name, value) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    return input;
}

function inputCheckbox(name, value) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = name;
    input.value = value;
    return input;
}

function inputSelect(name, options) {
    const select = document.createElement('select');
    select.name = name;
    return withAppended(select, options);
}

function inputSelectMultiple(name, options) {
    const select = document.createElement('select');
    select.name = name;
    select.multiple = true;
    return withAppended(select, options);
}

function selectOption(value) {
    const option = document.createElement('option');
    option.value = value;
    option.innerText = value;
    return option;
}

function generateHTML(html, returnFragment = false) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return returnFragment ? template.content : template.content.children[0];
}
