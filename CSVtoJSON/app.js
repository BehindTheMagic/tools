let inputcsv = document.getElementById("inputcsv");
let outputJSON = document.getElementById("outputJSON");
let inputStruct = document.getElementById('inputStruct');
let tablebody = document.getElementById("tablebody");
let papaParseResult;
let wipJSON;

// Fichier déjà dans le input, on gagne un clic à l'utilisateur.
if(inputcsv.files[0]){
	letsParse();
}


// https://jsfiddle.net/tovic/2wAzx/
function enableTab(el) {
	el.onkeydown = function(e) {
        if (e.keyCode === 9) { // tab was pressed

            // get caret position/selection
            var val = this.value,
            start = this.selectionStart,
            end = this.selectionEnd;

            // set textarea value to: text before caret + tab + text after caret
            this.value = val.substring(0, start) + '\t' + val.substring(end);

            // put caret at right position again
            this.selectionStart = this.selectionEnd = start + 1;

            // prevent the focus lose
            return false;

        }
    };
}

enableTab(inputStruct);

function addRegExpRule(){
	let tr = document.createElement("tr");
	tr.innerHTML =  '<td><input type="checkbox" onchange="refresh()"></td>'+
	'<td><input type="text" data-text="jsonkey" placeholder="name, title, ..."></td>'+
	'<td><input type="text" data-text="regexp" placeholder="\\[(.*?)\\]" minlength="1"></td>'+
	'<td><input type="text" data-text="replace" placeholder="<i>$1</i>"></td>'+
	'<td><button type="reset" onclick="removeRule(this)">X</button></td>'
	tablebody.appendChild(tr);
}

function removeRule(that){
	that.parentElement.parentElement.remove();
}

function letsParse(){
	Papa.parse(
		inputcsv.files[0],
		{
			encoding:"ascii",
			worker: true,
			header: false,
			dynamicTyping: true,
			skipEmptyLines: true,
			comments: "#",
			complete: function(results) {
				console.log(results.meta);
				if (results.errors.length > 0){
					console.error(results.errors)
				}
				papaParseResult = results.data;
				outputJSON.value = JSON.stringify(papaParseResult, null, "\t");
			}

		});
}

function refresh(){
	// wipJSON global pour l'étudier dans la console des DevTools
	wipJSON = papaParseResult;
	if(!wipJSON){
		console.log("Aucun fichier CSV chargé, traitement annulé.");
		return;
	}

	wipJSON = applyStructure(wipJSON);
	wipJSON = applyRegex(wipJSON);
	outputJSON.value = JSON.stringify(wipJSON, null, "\t");
}

function applyStructure(wipJSON){
	// Grosso modo: évaluation de code pour réaliser un JSON.parse 
	// avec data comme variable de contexte

	let structure = new Function('data', 'DROP', 'SKIP', 'return'  + inputStruct.value);
	let results = [];

	// gestionnaire pour le mot clé DROP, passe le drapeau DROPstate à true
	// si une condition de l'utilisateur est vérifiée.
	let DROPstate;
	let _DROP = function(value, condition){

		if(typeof condition == "string") {
			if (value.toString() === condition){
				DROPstate = true;
			}

		} else {
			if (condition){
				DROPstate = true;
			}

		}

		return value;
	}

	// gestionnaire pour le mot clé SKIP, rajoute la clé à SKIPkeys
	// si une condition de l'utilisateur est vérifiée.
	let SKIPkeys;
	let _SKIP = function(key, value, condition){
		if(typeof condition == "string") {
			if (value.toString() === condition){
				SKIPkeys.push(key);
			}

		} else {
			if (condition){
				SKIPkeys.push(key);
			}

		}

		return value;
	}

	for(let el of wipJSON){
		// Initialisation des états des gestionnaires pour DROP et SKIP
		DROPstate = false;
		SKIPkeys = [];

		// Projection des données sur la nouvelle structure
		// en fournissant les gestionnaires _DROP et _SKIP.
		let newEl = structure(el, _DROP, _SKIP);
		
		// Doit on délaisser ces nouvelles données : que vaut DROPstate ?
		if (DROPstate) { continue }

		// Quelles clés doit on supprimer de newEL ? les clés dans SKIPkeys
		for (let SKIPkey of SKIPkeys){
			delete newEl[SKIPkey];
		}

		results.push(newEl);
	}
	
	return results;
}

function applyRegex(wipJSON){
	for(let i = 0, n = tablebody.childElementCount; i < n; i++){
		let inputs = tablebody.children[i].querySelectorAll('input');

		// Reset du message d'erreur personnalisé pour éviter les erreurs de validation.
		inputs[2].setCustomValidity("");		
		
		if (!inputs[0].checked) {
			// On passe à la suite si le règle est décochée.
			inputs[2].required = false;
			continue;
		}

		// Champ requis car la case est cochée.
		inputs[2].required = true;

		if ( !inputs[2].checkValidity() ) {
			// Si le corps de la règle est vide, on passe à la suite
			// en indiquant que la règle n'est pas traité.
				inputs[2].setCustomValidity("RegExp non traité car vide.");
				inputs[2].reportValidity();
				continue; 
		}

		let JSONkeys = inputs[1].value;
		// Opérons sur toutes les clés existantes si *, sinon sur les clés données.
		if (JSONkeys == "*"){
			JSONkeys = Object.keys( wipJSON[0] );
		} else {
			JSONkeys = JSONkeys.split(",").map( item => item.trim() ).filter( item => item );
		}

		let regex = new RegExp(inputs[2].value, "g");
		let replacement = inputs[3].value;

		for(let el of wipJSON){
			for(let JSONkey of JSONkeys){
				// toString pour être sûr que la méthode replace existe
				el[JSONkey] = el[JSONkey].toString().replace(regex, replacement);
			}
		}
	}
	return wipJSON
}

function saveConfiguration(){

	try {

		let JSONexport = {};

		JSONexport.inputStruct = inputStruct.value;
		JSONexport.commentaires = document.getElementById('commentaires_conf').value;
		JSONexport.rules = [];

		for(let child of tablebody.children){
			let rule = {
				isChecked: child.querySelector('input[type="checkbox"]').checked,
				jsonkey: child.querySelector('input[data-text="jsonkey"]').value,
				regexp: child.querySelector('input[data-text="regexp"]').value,
				replace: child.querySelector('input[data-text="replace"]').value
			};
			JSONexport.rules.push(rule);
		}

		download(JSONexport, "CONF_");

	} catch(e){
		console.log(e);
	}
}

function loadConfiguration(that){

	if ( !confirm("êtes-vous sûr ?") ){ return; }

	for (let i = 1, n = tablebody.childElementCount; i < n; i++){
		tablebody.children[1].remove();
	}

	let fr = new FileReader();

	fr.onload = function(){
		let conf = JSON.parse(fr.result);

		document.getElementById('name_conf').value = that.files[0].name.split("CONF_")[1].split(".json")[0];
		inputStruct.value = conf.inputStruct;
		document.getElementById('commentaires_conf').value = conf.commentaires;

		for(let rule of conf.rules){
			let tr = tablebody.children[tablebody.childElementCount - 1];
			let inputs = tr.querySelectorAll("input");
			inputs[0].checked = rule.isChecked;
			inputs[1].value = rule.jsonkey;
			inputs[2].value = rule.regexp;
			inputs[3].value = rule.replace;
			addRegExpRule();
		}

		refresh();

	};

	fr.readAsText(that.files[0]);
}

function download(JSONexport, prefix){
	let name_conf = document.getElementById("name_conf");
	name_conf.setCustomValidity("");
	if (!name_conf.checkValidity()){
		name_conf.setCustomValidity('Il faut un nom de fichier pour pouvoir sauvegarder.');
		name_conf.reportValidity();
		return;
	}
	name_conf = name_conf.value;

	let a = document.createElement('a');
	a.setAttribute("download", prefix+name_conf+".json");
	a.setAttribute("href", 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(JSONexport, null, "\t")));
	a.style.display = 'none';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

function downloadFinal(){
	try {
		let JSONexport = JSON.parse(outputJSON.value);
		download(JSONexport, "");
	} catch(e) {
		console.log(e);
	}
}