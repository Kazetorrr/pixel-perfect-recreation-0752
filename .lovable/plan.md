# summ-it: jednotná změna ekonomiky

## Výsledek
Nahradit hráčskou měnu SP kroky, upravit všechny ceny a výpočty podle dodaného zadání a zachovat účty, guildy, zásoby, mapy a objevování. Změna se dokončí jako jeden konzistentní celek; expedice se nepředělává.

## 1. Bezpečný převod dosavadního postupu
- Před změnou ověřit skutečný stav účtů, rozpracovaných cest a zásob.
- Historická konfigurace i simulátor používají **100 kroků = 1 SP**. Dosavadní dostupný zůstatek převést tímto ověřeným poměrem jednorázově, bez opětovného přičítání historických kroků. Samostatně evidovat testovací přírůstky; neoznačovat je za skutečně nachozené kroky.
- Zachovat postavené výrobny a jejich úrovně. U existujících tržišť nad novým maximem zachovat dosažený postup záznamem, ale používat nejvyšší nové výhody úrovně III.
- Zachovat sklady i případné zásoby nad novou kapacitou: nic neodebrat, do uvolnění místa nepřijímat další zásoby a neprodukovat.
- Dosavadní domovská sídla zachovat; nový startovní balíček existujícím hráčům nepřidělovat.
- Rozpracované cesty převést včetně již zaplacené části, bez bezplatného dokončení či nové platby za uhrazený postup.

## 2. Kroky a nový účet
- Oddělit dostupné kroky, historicky nachozené skutečné kroky a testovací přírůstky. Nově připisovat 1:1, bez denního limitu a bez expirace.
- Nový účet začíná bez budov, s úrovněmi 0, kapacitou 110 a bez bezplatných kroků.
- Jednorázově přidělit domovu 18 modrých, 22 zelených, 16 žlutých a 14 červených zásob. Zachovat jejich nepřenosný původ i po naložení do expedice; lze je spotřebovat při vlastním objevu, ne posílat ani bodovat jako produkci.
- Nové domovské sídlo ověřit polohou v dříve dohodnutém okruhu 3/5/10 km podle typu a poté uzamknout. Bez dostupné polohy nedokončit nové založení domova.
- Domov bez budov se nezobrazuje jako rozvinuté sídlo guildy.

## 3. Výroba a sklady
- Čtyři výrobny, každá úrovně 0–6; denní základ 0/3/5/8/11/15/20, ceny 1 500/4 000/8 000/15 000/27 000/45 000.
- Zachovat místní účinnost, vesnici změnit na **+8 % výroby**.
- Uchovávat zlomkovou produkci, vypočítávat ji podle uplynulého času a při téměř plném skladu rozdělovat prostor poměrně mezi výrobny. Výsledek nesmí záviset na četnosti otevírání aplikace.
- Sklad úrovně 0–5: 110/175/250/340/460/600; ceny 2 500/6 500/14 000/28 000/50 000.
- Město dostává 15 % pouze z kapacity získané nad základ 110. Efektivní kapacitu zaokrouhlovat dolů na celé jednotky, tedy úroveň V ve městě 673.

## 4. Tržiště a přeprava
- Tržiště úrovně 0–3, ceny 6 000/18 000/48 000, odchozí denní kapacita 50/120/250 a sleva 0/20/35 %.
- Pro všechny zásilky jinému hráči vyžadovat tržiště odesílatele, i ve stejném městě. Příjemci stačí vlastní sídlo a volný sklad.
- Krajské město získá **20 % odchozí kapacity**, nikoliv původní slevu na dopravu.
- Meziměstská cena: zaokrouhlení nahoru z `(150 + 5 × geografická vzdálenost + 3 × množství) × (1 − sleva)`; ve stejné obci jinému členovi guildy zdarma, ale stále s tržištěm a denní kvótou.
- Vlastní meziměstské zásilky budou používat stejnou placenou logistiku a odchozí kvótu tržiště, aby neobcházely omezení pohybu zásob.
- Denní kvóty se počítají za kalendářní den v českém čase. Opakování stejného požadavku nesmí znovu odečíst kroky ani zdvojit zásilku.

## 5. Cestování a zakládání sídel
- Cesta stojí zaokrouhleně nahoru `500 + 45 × přímá geografická vzdálenost` z aktuální virtuální polohy. Zachovat možnost postupného placení cesty.
- Příjezd nezakládá sklad, nestěhuje zásoby a nenahrazuje fyzické GPS ověření POI.
- Samostatná akce založení sídla: druhé 12 000, další `5 000 × N × (N − 1)`. Nové sídlo má úrovně 0, sklad 110 a žádné zásoby.
- Existující vlastněná sídla zahrnout do pořadí zakládání; počet nesmí jít vynulovat opětovným založením.
- Založená sekundární sídla zobrazit mezi držbami guildy. Spravovat je lze bez opakovaného cestování.

## 6. Obrazovky a testovací režim
- Všude odstranit hráčské popisky SP a uvádět částky s ikonou stop; při nedostatku zobrazit chybějící kroky.
- Upravit výrobu, přehled, sklad, tržiště, cestování, zakládání sídel, zásilky, historii a strom úrovní tam, kde již existuje.
- Zachovat tmavý styl, barevné suroviny a existující ovládání expedice.
- Testovací kroky připisovat 1:1, odděleně od skutečné chůze. Simulátory kroků, času, resetu a demo GPS chránit oprávněním ověřovaným na serveru; běžným hráčům je skrýt a zakázat.

## 7. Ověření
- Doplnit a spustit testy konkrétních cen, limitů, bonusů, převodu a ochrany startovních zásob.
- Ověřit skutečný nový účet, stavbu za 1 500 kroků, produkci včetně offline a plného skladu, limity tržiště, zásilku bez tržiště i s ním, cestování a založení druhého/třetího sídla.
- Ověřit zachování existujících účtů, více majitelů na mapě, expedici a objevy bez dvojí spotřeby.
- Závěrem uvést, co prošlo ověřením, způsob převodu a případná neověřená místa.

## Technické řešení a hranice této změny
- Zachovat autoritativní pravidla v PostgreSQL konfiguraci a atomických RPC; klient pouze zobrazuje výsledky a ceny. Změny úložiště budou přidávající, s jednorázovým převodem a označením nahrazených položek.
- Původ zásob rozšířit o rozlišení startovních a vyrobených jednotek; ponechat původního dodavatele pro ekonomické bodování.
- Health Connect ani Apple HealthKit zatím v aplikaci **nejsou připojené**; stejně tak dosud neexistuje synchronizace hodinek, kterou by bylo možné jen zachovat. Připravit důvěryhodné připisování a evidenci unikátních událostí pro pozdější napojení, bez veřejné možnosti tvrdit libovolný počet skutečných kroků.
- Přímé čtení zdravotních dat vyžaduje mobilní aplikaci a souhlasy; nativní propojení Android/iOS není součástí této webové změny. Do té doby skutečné kroky nepřicházejí automaticky, funguje pouze autorizovaný simulátor.
- Oprávnění testera se nepřidělí automaticky všem existujícím hráčům. Pokud pro ověření nebude určený tester, bude potřeba vybrat účet.