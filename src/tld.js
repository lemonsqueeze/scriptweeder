function(){   // fake line, keep_editor_happy

    /********************************* TLD stuff ********************************/    

    function public_suffix_len(p)
    {
	if (p.length == 1)
	    return 1;
	var tld = p[p.length - 1];
	var sld = p[p.length - 2];
	var slds = second_level_domains[tld];
	if (common_second_level_domains[sld] ||
	    (slds && slds.indexOf(sld) != -1))
	    return 2;
	return 1;
    }
    
    var common_second_level_domains = 
    { "co":1,    "ac":1,    "or":1,    "tm":1,
      "com":1, "net":1, "org":1, "edu":1, "gov":1, "mil":1, "sch":1,
      "int":1, "nom":1, "biz":1, "gob":1, "info":1, "asso":1
    };

    // public suffix list, generated from http://publicsuffix.org data.
    // common_second_level_domains and long stuff omitted, 2 levels max.
    var second_level_domains =
    {
    "aero": [ "caa", "club", "crew", "dgca", "fuel", "res", "show", "taxi" ],
    "ai":   [ "off" ],
    "ao":   [ "ed", "gv", "it", "og", "pb" ],
    "arpa": [ "e164", "ip6", "iris", "uri", "urn" ],
    "at":   [ "gv", "priv" ],
    "au":   [ "act", "asn", "conf", "id", "nsw", "nt", "oz", "qld", "sa", "tas", "vic", "wa" ],
    "az":   [ "name", "pp", "pro" ],
    "ba":   [ "rs", "unbi", "unsa" ],
    "bg":   [ "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z" ],
    "bj":   [ "gouv" ],
    "bo":   [ "tv" ],
    "br":   [ "adm", "adv", "agr", "am", "arq", "art", "ato", "b", "bio", "blog", "bmd", "cim", "cng", "cnt", "coop", "ecn", "eco", "emp", "eng", "esp", "etc", "eti", "far", "flog", "fm", "fnd", "fot", "fst", "g12", "ggf", "imb", "ind", "inf", "jor", "jus", "leg", "lel", "mat", "med", "mus", "not", "ntr", "odo", "ppg", "pro", "psc", "psi", "qsl", "rec", "slg", "srv", "taxi", "teo", "tmp", "trd", "tur", "tv", "vet", "vlog", "wiki", "zlg" ],
    "by":   [ "of" ],
    "ca":   [ "ab", "bc", "gc", "mb", "nb", "nf", "nl", "ns", "nt", "nu", "on", "pe", "qc", "sk", "yk" ],
    "ci":   [ "ed", "go", "gouv", "md" ],
    "cn":   [ "ah", "bj", "cq", "fj", "gd", "gs", "gx", "gz", "ha", "hb", "he", "hi", "hk", "hl", "hn", "jl", "js", "jx", "ln", "mo", "nm", "nx", "qh", "sc", "sd", "sh", "sn", "sx", "tj", "tw", "xj", "xz", "yn", "zj" ],
    "co":   [ "arts", "firm", "rec", "web" ],
    "com":  [ "ar", "br", "cn", "de", "eu", "gb", "gr", "hu", "jpn", "kr", "no", "qc", "ru", "sa", "se", "uk", "us", "uy", "za" ],
    "cr":   [ "ed", "fi", "go", "sa" ],
    "cu":   [ "inf" ],
    "cx":   [ "ath" ],
    "do":   [ "art", "sld", "web" ],
    "dz":   [ "art", "pol" ],
    "ec":   [ "fin", "k12", "med", "pro" ],
    "ee":   [ "aip", "fie", "lib", "med", "pri", "riik" ],
    "eg":   [ "eun", "name", "sci" ],
    "fi":   [ "iki" ],
    "fr":   [ "cci", "gouv", "port", "prd" ],
    "ge":   [ "pvt" ],
    "gi":   [ "ltd", "mod" ],
    "gp":   [ "mobi" ],
    "gt":   [ "ind" ],
    "hk":   [ "idv" ],
    "hr":   [ "from", "iz", "name" ],
    "ht":   [ "art", "coop", "firm", "gouv", "med", "pol", "pro", "rel", "shop" ],
    "hu":   [ "2000", "bolt", "city", "film", "news", "priv", "sex", "shop", "suli", "szex" ],
    "id":   [ "go", "my", "web" ],
    "im":   [ "nic" ],
    "in":   [ "firm", "gen", "ind", "nic", "res" ],
    "int":  [ "eu" ],
    "ir":   [ "id" ],
    "it":   [ "ag", "al", "an", "ao", "ap", "aq", "ar", "asti", "at", "av", "ba", "bari", "bg", "bi", "bl", "bn", "bo", "br", "bs", "bt", "bz", "ca", "cb", "ce", "ch", "ci", "cl", "cn", "como", "cr", "cs", "ct", "cz", "en", "enna", "fc", "fe", "fg", "fi", "fm", "fr", "ge", "go", "gr", "im", "is", "kr", "lc", "le", "li", "lo", "lodi", "lt", "lu", "mb", "mc", "me", "mi", "mn", "mo", "ms", "mt", "na", "no", "nu", "og", "ot", "pa", "pc", "pd", "pe", "pg", "pi", "pisa", "pn", "po", "pr", "pt", "pu", "pv", "pz", "ra", "rc", "re", "rg", "ri", "rm", "rn", "ro", "roma", "rome", "sa", "si", "so", "sp", "sr", "ss", "sv", "ta", "te", "tn", "to", "tp", "tr", "ts", "tv", "ud", "va", "vb", "vc", "ve", "vi", "vr", "vs", "vt", "vv" ],
    "jo":   [ "name" ],
    "jp":   [ "ad", "ed", "gifu", "go", "gr", "lg", "mie", "nara", "ne", "oita", "saga" ],
    "km":   [ "ass", "coop", "gouv", "prd" ],
    "kp":   [ "rep", "tra" ],
    "kr":   [ "es", "go", "hs", "jeju", "kg", "ms", "ne", "pe", "re", "sc" ],
    "la":   [ "c", "per" ],
    "lk":   [ "assn", "grp", "ltd", "ngo", "soc", "web" ],
    "lv":   [ "asn", "conf", "id" ],
    "ly":   [ "id", "med", "plc" ],
    "me":   [ "its", "priv" ],
    "mg":   [ "prd" ],
    "mk":   [ "inf", "name" ],
    "ml":   [ "gouv" ],
    "mn":   [ "nyc" ],
    "museum": [ "air", "and", "art", "arts", "axis", "bahn", "bale", "bern", "bill", "bonn", "bus", "can", "coal", "cody", "dali", "ddr", "farm", "film", "frog", "glas", "graz", "iraq", "iron", "jfk", "juif", "kids", "lans", "linz", "mad", "manx", "mill", "moma", "nrw", "nyc", "nyny", "roma", "satx", "silk", "ski", "spy", "tank", "tcm", "time", "town", "tree", "ulm", "usa", "utah", "uvic", "war", "york" ],
    "mv":   [ "aero", "coop", "name", "pro" ],
    "mw":   [ "coop" ],
    "my":   [ "name" ],
    "na":   [ "ca", "cc", "dr", "in", "mobi", "mx", "name", "pro", "tv", "us", "ws" ],
    "net":  [ "gb", "hu", "jp", "se", "uk", "za" ],
    "nf":   [ "arts", "firm", "per", "rec", "web" ],
    "nl":   [ "bv" ],
    "no":   [ "aa", "ah", "al", "alta", "amli", "amot", "arna", "aure", "berg", "bodo", "bokn", "bu", "dep", "eid", "etne", "fet", "fhs", "fla", "flå", "fm", "frei", "fusa", "gol", "gran", "grue", "ha", "hl", "hm", "hof", "hol", "hole", "hå", "ivgu", "kvam", "leka", "lier", "lom", "lund", "moss", "mr", "nl", "nt", "odda", "of", "ol", "osen", "oslo", "oyer", "priv", "rade", "rana", "rl", "roan", "rost", "sel", "sf", "ski", "sola", "st", "stat", "sula", "sund", "tana", "time", "tinn", "tr", "va", "vaga", "vang", "vega", "vf", "vgs", "vik", "voss", "ål", "ås" ],
    "nu":   [ "mine" ],
    "org":  [ "ae", "us", "za" ],
    "pa":   [ "abo", "ing", "med", "sld" ],
    "ph":   [ "i", "ngo" ],
    "pk":   [ "fam", "gok", "gon", "gop", "gos", "web" ],
    "pl":   [ "agro", "aid", "art", "atm", "auto", "elk", "gda", "gsm", "irc", "lapy", "mail", "med", "ngo", "nysa", "pc", "pila", "pisz", "priv", "rel", "sex", "shop", "sos", "waw", "wroc" ],
    "pr":   [ "est", "isla", "name", "pro", "prof" ],
    "pro":  [ "aca", "bar", "cpa", "eng", "jur", "law", "med" ],
    "ps":   [ "plo", "sec" ],
    "pt":   [ "nome", "publ" ],
    "pw":   [ "ed", "go", "ne" ],
    "py":   [ "coop" ],
    "qa":   [ "name" ],
    "ro":   [ "arts", "firm", "nt", "rec", "www" ],
    "rs":   [ "in" ],
    "ru":   [ "amur", "bir", "cbg", "chel", "cmw", "jar", "kchr", "khv", "kms", "komi", "mari", "msk", "nkz", "nnov", "nov", "nsk", "omsk", "perm", "pp", "ptz", "rnd", "snz", "spb", "stv", "test", "tom", "tsk", "tula", "tuva", "tver", "udm", "vrn" ],
    "rw":   [ "gouv" ],
    "sa":   [ "med", "pub" ],
    "sd":   [ "med", "tv" ],
    "se":   [ "a", "b", "bd", "c", "d", "e", "f", "fh", "fhsk", "fhv", "g", "h", "i", "k", "l", "m", "n", "o", "p", "pp", "r", "s", "sshn", "t", "u", "w", "x", "y", "z" ],
    "sg":   [ "per" ],
    "sn":   [ "art", "gouv", "univ" ],
    "th":   [ "go", "in", "mi" ],
    "tj":   [ "go", "name", "nic", "test", "web" ],
    "tn":   [ "ens", "fin", "ind", "intl", "nat", "rnrt", "rns", "rnu" ],
    "tt":   [ "aero", "coop", "jobs", "mobi", "name", "pro" ],
    "tw":   [ "club", "ebiz", "game", "idv" ],
    "tz":   [ "go", "me", "mobi", "ne", "sc", "tv" ],
    "ua":   [ "ck", "cn", "cr", "cv", "dn", "dp", "if", "in", "kh", "kiev", "km", "kr", "krym", "ks", "kv", "kyiv", "lg", "lt", "lv", "lviv", "mk", "od", "pl", "pp", "rv", "sb", "sm", "sumy", "te", "uz", "vn", "zp", "zt" ],
    "ug":   [ "go", "ne", "sc" ],
    "us":   [ "ak", "al", "ar", "as", "az", "ca", "ct", "dc", "de", "dni", "fed", "fl", "ga", "gu", "hi", "ia", "id", "il", "in", "isa", "kids", "ks", "ky", "la", "ma", "md", "me", "mi", "mn", "mo", "ms", "mt", "nc", "nd", "ne", "nh", "nj", "nm", "nsn", "nv", "ny", "oh", "ok", "pa", "pr", "ri", "sc", "sd", "tn", "tx", "ut", "va", "vi", "vt", "wa", "wi", "wv", "wy" ],
    "uy":   [ "gub" ],
    "ve":   [ "e12", "web" ],
    "vi":   [ "k12" ],
    "vn":   [ "name", "pro" ]
    };
    
}   // keep_editor_happy
