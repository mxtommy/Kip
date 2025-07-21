import { Component, DestroyRef, OnInit, inject, input } from '@angular/core';
import { AbstractControl, UntypedFormControl, ValidationErrors, ValidatorFn, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subscription, debounceTime, map, startWith } from 'rxjs';
import { MatOption } from '@angular/material/core';
import { MatIconButton } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { MatAutocompleteTrigger, MatAutocomplete } from '@angular/material/autocomplete';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface ITzDefinition {
  offset: string;
  label: string;
}

function requireMatch(tz: ITzDefinition[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const pathFound = tz.some(array => array.label === control.value);
    return pathFound ? null : { requireMatch: true };
  };
}

export const getDynamicTimeZones = (): ITzDefinition[] => {
  //@ts-expect-error method is supported
  const timeZones = Intl.supportedValuesOf('timeZone'); // Get all supported time zones
  const now = new Date();

  return timeZones.map((timeZone) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value || '';
    return { offset, label: timeZone };
  });
};

@Component({
    selector: 'display-datetime-options',
    templateUrl: './display-datetime.component.html',
    styleUrls: ['./display-datetime.component.css'],
    imports: [MatFormField, MatLabel, MatInput, FormsModule, ReactiveFormsModule, MatAutocompleteTrigger, MatIconButton, MatSuffix, MatAutocomplete, MatOption, AsyncPipe]
})
export class DisplayDatetimeComponent implements OnInit {
  private readonly _destroyRef = inject(DestroyRef);
  readonly dateFormat = input<UntypedFormControl>(undefined);
  readonly dateTimezone = input<UntypedFormControl>(undefined);
  private tz: ITzDefinition[] = [];
  public filteredTZ: Observable<ITzDefinition[]>;
  private filteredTZSubscription: Subscription = null;

  constructor() { }

  ngOnInit(): void {
    //@ts-expect-error until we upgrade to TypeScript v5+
    if (typeof Intl.supportedValuesOf !== "undefined") {
      this.tz = getDynamicTimeZones().sort((a, b) => this.compareOffsets(a.offset, b.offset));
    } else {
      // Revert to static list
      console.log("[Widget Options] Feature not supported. Using static Time Zone list");
      this.tz = [
        {
          offset: "GMT",
          label: "Africa/Abidjan",
        },
        {
          offset: "GMT",
          label: "Africa/Accra",
        },
        {
          offset: "GMT+3",
          label: "Africa/Addis_Ababa",
        },
        {
          offset: "GMT+1",
          label: "Africa/Algiers",
        },
        {
          offset: "GMT+3",
          label: "Africa/Asmera",
        },
        {
          offset: "GMT",
          label: "Africa/Bamako",
        },
        {
          offset: "GMT+1",
          label: "Africa/Bangui",
        },
        {
          offset: "GMT",
          label: "Africa/Banjul",
        },
        {
          offset: "GMT",
          label: "Africa/Bissau",
        },
        {
          offset: "GMT+2",
          label: "Africa/Blantyre",
        },
        {
          offset: "GMT+1",
          label: "Africa/Brazzaville",
        },
        {
          offset: "GMT+2",
          label: "Africa/Bujumbura",
        },
        {
          offset: "GMT+2",
          label: "Africa/Cairo",
        },
        {
          offset: "GMT",
          label: "Africa/Casablanca",
        },
        {
          offset: "GMT+2",
          label: "Africa/Ceuta",
        },
        {
          offset: "GMT",
          label: "Africa/Conakry",
        },
        {
          offset: "GMT",
          label: "Africa/Dakar",
        },
        {
          offset: "GMT+3",
          label: "Africa/Dar_es_Salaam",
        },
        {
          offset: "GMT+3",
          label: "Africa/Djibouti",
        },
        {
          offset: "GMT+1",
          label: "Africa/Douala",
        },
        {
          offset: "GMT",
          label: "Africa/El_Aaiun",
        },
        {
          offset: "GMT",
          label: "Africa/Freetown",
        },
        {
          offset: "GMT+2",
          label: "Africa/Gaborone",
        },
        {
          offset: "GMT+2",
          label: "Africa/Harare",
        },
        {
          offset: "GMT+2",
          label: "Africa/Johannesburg",
        },
        {
          offset: "GMT+2",
          label: "Africa/Juba",
        },
        {
          offset: "GMT+3",
          label: "Africa/Kampala",
        },
        {
          offset: "GMT+2",
          label: "Africa/Khartoum",
        },
        {
          offset: "GMT+2",
          label: "Africa/Kigali",
        },
        {
          offset: "GMT+1",
          label: "Africa/Kinshasa",
        },
        {
          offset: "GMT+1",
          label: "Africa/Lagos",
        },
        {
          offset: "GMT+1",
          label: "Africa/Libreville",
        },
        {
          offset: "GMT",
          label: "Africa/Lome",
        },
        {
          offset: "GMT+1",
          label: "Africa/Luanda",
        },
        {
          offset: "GMT+2",
          label: "Africa/Lubumbashi",
        },
        {
          offset: "GMT+2",
          label: "Africa/Lusaka",
        },
        {
          offset: "GMT+1",
          label: "Africa/Malabo",
        },
        {
          offset: "GMT+2",
          label: "Africa/Maputo",
        },
        {
          offset: "GMT+2",
          label: "Africa/Maseru",
        },
        {
          offset: "GMT+2",
          label: "Africa/Mbabane",
        },
        {
          offset: "GMT+3",
          label: "Africa/Mogadishu",
        },
        {
          offset: "GMT",
          label: "Africa/Monrovia",
        },
        {
          offset: "GMT+3",
          label: "Africa/Nairobi",
        },
        {
          offset: "GMT+1",
          label: "Africa/Ndjamena",
        },
        {
          offset: "GMT+1",
          label: "Africa/Niamey",
        },
        {
          offset: "GMT",
          label: "Africa/Nouakchott",
        },
        {
          offset: "GMT",
          label: "Africa/Ouagadougou",
        },
        {
          offset: "GMT+1",
          label: "Africa/Porto-Novo",
        },
        {
          offset: "GMT",
          label: "Africa/Sao_Tome",
        },
        {
          offset: "GMT+2",
          label: "Africa/Tripoli",
        },
        {
          offset: "GMT+1",
          label: "Africa/Tunis",
        },
        {
          offset: "GMT+2",
          label: "Africa/Windhoek",
        },
        {
          offset: "GMT-9",
          label: "America/Adak",
        },
        {
          offset: "GMT-8",
          label: "America/Anchorage",
        },
        {
          offset: "GMT-4",
          label: "America/Anguilla",
        },
        {
          offset: "GMT-4",
          label: "America/Antigua",
        },
        {
          offset: "GMT-3",
          label: "America/Araguaina",
        },
        {
          offset: "GMT-3",
          label: "America/Argentina/La_Rioja",
        },
        {
          offset: "GMT-3",
          label: "America/Argentina/Rio_Gallegos",
        },
        {
          offset: "GMT-3",
          label: "America/Argentina/Salta",
        },
        {
          offset: "GMT-3",
          label: "America/Argentina/San_Juan",
        },
        {
          offset: "GMT-3",
          label: "America/Argentina/San_Luis",
        },
        {
          offset: "GMT-3",
          label: "America/Argentina/Tucuman",
        },
        {
          offset: "GMT-3",
          label: "America/Argentina/Ushuaia",
        },
        {
          offset: "GMT-4",
          label: "America/Aruba",
        },
        {
          offset: "GMT-3",
          label: "America/Asuncion",
        },
        {
          offset: "GMT-3",
          label: "America/Bahia",
        },
        {
          offset: "GMT-6",
          label: "America/Bahia_Banderas",
        },
        {
          offset: "GMT-4",
          label: "America/Barbados",
        },
        {
          offset: "GMT-3",
          label: "America/Belem",
        },
        {
          offset: "GMT-6",
          label: "America/Belize",
        },
        {
          offset: "GMT-4",
          label: "America/Blanc-Sablon",
        },
        {
          offset: "GMT-4",
          label: "America/Boa_Vista",
        },
        {
          offset: "GMT-5",
          label: "America/Bogota",
        },
        {
          offset: "GMT-6",
          label: "America/Boise",
        },
        {
          offset: "GMT-3",
          label: "America/Buenos_Aires",
        },
        {
          offset: "GMT-6",
          label: "America/Cambridge_Bay",
        },
        {
          offset: "GMT-4",
          label: "America/Campo_Grande",
        },
        {
          offset: "GMT-5",
          label: "America/Cancun",
        },
        {
          offset: "GMT-4",
          label: "America/Caracas",
        },
        {
          offset: "GMT-3",
          label: "America/Catamarca",
        },
        {
          offset: "GMT-3",
          label: "America/Cayenne",
        },
        {
          offset: "GMT-5",
          label: "America/Cayman",
        },
        {
          offset: "GMT-5",
          label: "America/Chicago",
        },
        {
          offset: "GMT-6",
          label: "America/Chihuahua",
        },
        {
          offset: "GMT-6",
          label: "America/Ciudad_Juarez",
        },
        {
          offset: "GMT-5",
          label: "America/Coral_Harbour",
        },
        {
          offset: "GMT-3",
          label: "America/Cordoba",
        },
        {
          offset: "GMT-6",
          label: "America/Costa_Rica",
        },
        {
          offset: "GMT-7",
          label: "America/Creston",
        },
        {
          offset: "GMT-4",
          label: "America/Cuiaba",
        },
        {
          offset: "GMT-4",
          label: "America/Curacao",
        },
        {
          offset: "GMT",
          label: "America/Danmarkshavn",
        },
        {
          offset: "GMT-7",
          label: "America/Dawson",
        },
        {
          offset: "GMT-7",
          label: "America/Dawson_Creek",
        },
        {
          offset: "GMT-6",
          label: "America/Denver",
        },
        {
          offset: "GMT-4",
          label: "America/Detroit",
        },
        {
          offset: "GMT-4",
          label: "America/Dominica",
        },
        {
          offset: "GMT-6",
          label: "America/Edmonton",
        },
        {
          offset: "GMT-5",
          label: "America/Eirunepe",
        },
        {
          offset: "GMT-6",
          label: "America/El_Salvador",
        },
        {
          offset: "GMT-7",
          label: "America/Fort_Nelson",
        },
        {
          offset: "GMT-3",
          label: "America/Fortaleza",
        },
        {
          offset: "GMT-3",
          label: "America/Glace_Bay",
        },
        {
          offset: "GMT-1",
          label: "America/Godthab",
        },
        {
          offset: "GMT-3",
          label: "America/Goose_Bay",
        },
        {
          offset: "GMT-4",
          label: "America/Grand_Turk",
        },
        {
          offset: "GMT-4",
          label: "America/Grenada",
        },
        {
          offset: "GMT-4",
          label: "America/Guadeloupe",
        },
        {
          offset: "GMT-6",
          label: "America/Guatemala",
        },
        {
          offset: "GMT-5",
          label: "America/Guayaquil",
        },
        {
          offset: "GMT-4",
          label: "America/Guyana",
        },
        {
          offset: "GMT-3",
          label: "America/Halifax",
        },
        {
          offset: "GMT-4",
          label: "America/Havana",
        },
        {
          offset: "GMT-7",
          label: "America/Hermosillo",
        },
        {
          offset: "GMT-5",
          label: "America/Indiana/Knox",
        },
        {
          offset: "GMT-4",
          label: "America/Indiana/Marengo",
        },
        {
          offset: "GMT-4",
          label: "America/Indiana/Petersburg",
        },
        {
          offset: "GMT-5",
          label: "America/Indiana/Tell_City",
        },
        {
          offset: "GMT-4",
          label: "America/Indiana/Vevay",
        },
        {
          offset: "GMT-4",
          label: "America/Indiana/Vincennes",
        },
        {
          offset: "GMT-4",
          label: "America/Indiana/Winamac",
        },
        {
          offset: "GMT-4",
          label: "America/Indianapolis",
        },
        {
          offset: "GMT-6",
          label: "America/Inuvik",
        },
        {
          offset: "GMT-4",
          label: "America/Iqaluit",
        },
        {
          offset: "GMT-5",
          label: "America/Jamaica",
        },
        {
          offset: "GMT-3",
          label: "America/Jujuy",
        },
        {
          offset: "GMT-8",
          label: "America/Juneau",
        },
        {
          offset: "GMT-4",
          label: "America/Kentucky/Monticello",
        },
        {
          offset: "GMT-4",
          label: "America/Kralendijk",
        },
        {
          offset: "GMT-4",
          label: "America/La_Paz",
        },
        {
          offset: "GMT-5",
          label: "America/Lima",
        },
        {
          offset: "GMT-7",
          label: "America/Los_Angeles",
        },
        {
          offset: "GMT-4",
          label: "America/Louisville",
        },
        {
          offset: "GMT-4",
          label: "America/Lower_Princes",
        },
        {
          offset: "GMT-3",
          label: "America/Maceio",
        },
        {
          offset: "GMT-6",
          label: "America/Managua",
        },
        {
          offset: "GMT-4",
          label: "America/Manaus",
        },
        {
          offset: "GMT-4",
          label: "America/Marigot",
        },
        {
          offset: "GMT-4",
          label: "America/Martinique",
        },
        {
          offset: "GMT-5",
          label: "America/Matamoros",
        },
        {
          offset: "GMT-7",
          label: "America/Mazatlan",
        },
        {
          offset: "GMT-3",
          label: "America/Mendoza",
        },
        {
          offset: "GMT-5",
          label: "America/Menominee",
        },
        {
          offset: "GMT-6",
          label: "America/Merida",
        },
        {
          offset: "GMT-8",
          label: "America/Metlakatla",
        },
        {
          offset: "GMT-6",
          label: "America/Mexico_City",
        },
        {
          offset: "GMT-2",
          label: "America/Miquelon",
        },
        {
          offset: "GMT-3",
          label: "America/Moncton",
        },
        {
          offset: "GMT-6",
          label: "America/Monterrey",
        },
        {
          offset: "GMT-3",
          label: "America/Montevideo",
        },
        {
          offset: "GMT-4",
          label: "America/Montserrat",
        },
        {
          offset: "GMT-4",
          label: "America/Nassau",
        },
        {
          offset: "GMT-4",
          label: "America/New_York",
        },
        {
          offset: "GMT-8",
          label: "America/Nome",
        },
        {
          offset: "GMT-2",
          label: "America/Noronha",
        },
        {
          offset: "GMT-5",
          label: "America/North_Dakota/Beulah",
        },
        {
          offset: "GMT-5",
          label: "America/North_Dakota/Center",
        },
        {
          offset: "GMT-5",
          label: "America/North_Dakota/New_Salem",
        },
        {
          offset: "GMT-5",
          label: "America/Ojinaga",
        },
        {
          offset: "GMT-5",
          label: "America/Panama",
        },
        {
          offset: "GMT-3",
          label: "America/Paramaribo",
        },
        {
          offset: "GMT-7",
          label: "America/Phoenix",
        },
        {
          offset: "GMT-4",
          label: "America/Port-au-Prince",
        },
        {
          offset: "GMT-4",
          label: "America/Port_of_Spain",
        },
        {
          offset: "GMT-4",
          label: "America/Porto_Velho",
        },
        {
          offset: "GMT-4",
          label: "America/Puerto_Rico",
        },
        {
          offset: "GMT-3",
          label: "America/Punta_Arenas",
        },
        {
          offset: "GMT-5",
          label: "America/Rankin_Inlet",
        },
        {
          offset: "GMT-3",
          label: "America/Recife",
        },
        {
          offset: "GMT-6",
          label: "America/Regina",
        },
        {
          offset: "GMT-5",
          label: "America/Resolute",
        },
        {
          offset: "GMT-5",
          label: "America/Rio_Branco",
        },
        {
          offset: "GMT-3",
          label: "America/Santarem",
        },
        {
          offset: "GMT-3",
          label: "America/Santiago",
        },
        {
          offset: "GMT-4",
          label: "America/Santo_Domingo",
        },
        {
          offset: "GMT-3",
          label: "America/Sao_Paulo",
        },
        {
          offset: "GMT-1",
          label: "America/Scoresbysund",
        },
        {
          offset: "GMT-8",
          label: "America/Sitka",
        },
        {
          offset: "GMT-4",
          label: "America/St_Barthelemy",
        },
        {
          offset: "GMT-2:30",
          label: "America/St_Johns",
        },
        {
          offset: "GMT-4",
          label: "America/St_Kitts",
        },
        {
          offset: "GMT-4",
          label: "America/St_Lucia",
        },
        {
          offset: "GMT-4",
          label: "America/St_Thomas",
        },
        {
          offset: "GMT-4",
          label: "America/St_Vincent",
        },
        {
          offset: "GMT-6",
          label: "America/Swift_Current",
        },
        {
          offset: "GMT-6",
          label: "America/Tegucigalpa",
        },
        {
          offset: "GMT-3",
          label: "America/Thule",
        },
        {
          offset: "GMT-7",
          label: "America/Tijuana",
        },
        {
          offset: "GMT-4",
          label: "America/Toronto",
        },
        {
          offset: "GMT-4",
          label: "America/Tortola",
        },
        {
          offset: "GMT-7",
          label: "America/Vancouver",
        },
        {
          offset: "GMT-7",
          label: "America/Whitehorse",
        },
        {
          offset: "GMT-5",
          label: "America/Winnipeg",
        },
        {
          offset: "GMT-8",
          label: "America/Yakutat",
        },
        {
          offset: "GMT+8",
          label: "Antarctica/Casey",
        },
        {
          offset: "GMT+7",
          label: "Antarctica/Davis",
        },
        {
          offset: "GMT+10",
          label: "Antarctica/DumontDUrville",
        },
        {
          offset: "GMT+11",
          label: "Antarctica/Macquarie",
        },
        {
          offset: "GMT+5",
          label: "Antarctica/Mawson",
        },
        {
          offset: "GMT+13",
          label: "Antarctica/McMurdo",
        },
        {
          offset: "GMT-3",
          label: "Antarctica/Palmer",
        },
        {
          offset: "GMT-3",
          label: "Antarctica/Rothera",
        },
        {
          offset: "GMT+3",
          label: "Antarctica/Syowa",
        },
        {
          offset: "GMT+2",
          label: "Antarctica/Troll",
        },
        {
          offset: "GMT+5",
          label: "Antarctica/Vostok",
        },
        {
          offset: "GMT+2",
          label: "Arctic/Longyearbyen",
        },
        {
          offset: "GMT+3",
          label: "Asia/Aden",
        },
        {
          offset: "GMT+5",
          label: "Asia/Almaty",
        },
        {
          offset: "GMT+3",
          label: "Asia/Amman",
        },
        {
          offset: "GMT+12",
          label: "Asia/Anadyr",
        },
        {
          offset: "GMT+5",
          label: "Asia/Aqtau",
        },
        {
          offset: "GMT+5",
          label: "Asia/Aqtobe",
        },
        {
          offset: "GMT+5",
          label: "Asia/Ashgabat",
        },
        {
          offset: "GMT+5",
          label: "Asia/Atyrau",
        },
        {
          offset: "GMT+3",
          label: "Asia/Baghdad",
        },
        {
          offset: "GMT+3",
          label: "Asia/Bahrain",
        },
        {
          offset: "GMT+4",
          label: "Asia/Baku",
        },
        {
          offset: "GMT+7",
          label: "Asia/Bangkok",
        },
        {
          offset: "GMT+7",
          label: "Asia/Barnaul",
        },
        {
          offset: "GMT+3",
          label: "Asia/Beirut",
        },
        {
          offset: "GMT+6",
          label: "Asia/Bishkek",
        },
        {
          offset: "GMT+8",
          label: "Asia/Brunei",
        },
        {
          offset: "GMT+5:30",
          label: "Asia/Calcutta",
        },
        {
          offset: "GMT+9",
          label: "Asia/Chita",
        },
        {
          offset: "GMT+5:30",
          label: "Asia/Colombo",
        },
        {
          offset: "GMT+3",
          label: "Asia/Damascus",
        },
        {
          offset: "GMT+6",
          label: "Asia/Dhaka",
        },
        {
          offset: "GMT+9",
          label: "Asia/Dili",
        },
        {
          offset: "GMT+4",
          label: "Asia/Dubai",
        },
        {
          offset: "GMT+5",
          label: "Asia/Dushanbe",
        },
        {
          offset: "GMT+3",
          label: "Asia/Famagusta",
        },
        {
          offset: "GMT+2",
          label: "Asia/Gaza",
        },
        {
          offset: "GMT+2",
          label: "Asia/Hebron",
        },
        {
          offset: "GMT+8",
          label: "Asia/Hong_Kong",
        },
        {
          offset: "GMT+7",
          label: "Asia/Hovd",
        },
        {
          offset: "GMT+8",
          label: "Asia/Irkutsk",
        },
        {
          offset: "GMT+7",
          label: "Asia/Jakarta",
        },
        {
          offset: "GMT+9",
          label: "Asia/Jayapura",
        },
        {
          offset: "GMT+3",
          label: "Asia/Jerusalem",
        },
        {
          offset: "GMT+4:30",
          label: "Asia/Kabul",
        },
        {
          offset: "GMT+12",
          label: "Asia/Kamchatka",
        },
        {
          offset: "GMT+5",
          label: "Asia/Karachi",
        },
        {
          offset: "GMT+5:45",
          label: "Asia/Katmandu",
        },
        {
          offset: "GMT+9",
          label: "Asia/Khandyga",
        },
        {
          offset: "GMT+7",
          label: "Asia/Krasnoyarsk",
        },
        {
          offset: "GMT+8",
          label: "Asia/Kuala_Lumpur",
        },
        {
          offset: "GMT+8",
          label: "Asia/Kuching",
        },
        {
          offset: "GMT+3",
          label: "Asia/Kuwait",
        },
        {
          offset: "GMT+8",
          label: "Asia/Macau",
        },
        {
          offset: "GMT+11",
          label: "Asia/Magadan",
        },
        {
          offset: "GMT+8",
          label: "Asia/Makassar",
        },
        {
          offset: "GMT+8",
          label: "Asia/Manila",
        },
        {
          offset: "GMT+4",
          label: "Asia/Muscat",
        },
        {
          offset: "GMT+3",
          label: "Asia/Nicosia",
        },
        {
          offset: "GMT+7",
          label: "Asia/Novokuznetsk",
        },
        {
          offset: "GMT+7",
          label: "Asia/Novosibirsk",
        },
        {
          offset: "GMT+6",
          label: "Asia/Omsk",
        },
        {
          offset: "GMT+5",
          label: "Asia/Oral",
        },
        {
          offset: "GMT+7",
          label: "Asia/Phnom_Penh",
        },
        {
          offset: "GMT+7",
          label: "Asia/Pontianak",
        },
        {
          offset: "GMT+9",
          label: "Asia/Pyongyang",
        },
        {
          offset: "GMT+3",
          label: "Asia/Qatar",
        },
        {
          offset: "GMT+5",
          label: "Asia/Qostanay",
        },
        {
          offset: "GMT+5",
          label: "Asia/Qyzylorda",
        },
        {
          offset: "GMT+6:30",
          label: "Asia/Rangoon",
        },
        {
          offset: "GMT+3",
          label: "Asia/Riyadh",
        },
        {
          offset: "GMT+7",
          label: "Asia/Saigon",
        },
        {
          offset: "GMT+11",
          label: "Asia/Sakhalin",
        },
        {
          offset: "GMT+5",
          label: "Asia/Samarkand",
        },
        {
          offset: "GMT+9",
          label: "Asia/Seoul",
        },
        {
          offset: "GMT+8",
          label: "Asia/Shanghai",
        },
        {
          offset: "GMT+8",
          label: "Asia/Singapore",
        },
        {
          offset: "GMT+11",
          label: "Asia/Srednekolymsk",
        },
        {
          offset: "GMT+8",
          label: "Asia/Taipei",
        },
        {
          offset: "GMT+5",
          label: "Asia/Tashkent",
        },
        {
          offset: "GMT+4",
          label: "Asia/Tbilisi",
        },
        {
          offset: "GMT+3:30",
          label: "Asia/Tehran",
        },
        {
          offset: "GMT+6",
          label: "Asia/Thimphu",
        },
        {
          offset: "GMT+9",
          label: "Asia/Tokyo",
        },
        {
          offset: "GMT+7",
          label: "Asia/Tomsk",
        },
        {
          offset: "GMT+8",
          label: "Asia/Ulaanbaatar",
        },
        {
          offset: "GMT+6",
          label: "Asia/Urumqi",
        },
        {
          offset: "GMT+10",
          label: "Asia/Ust-Nera",
        },
        {
          offset: "GMT+7",
          label: "Asia/Vientiane",
        },
        {
          offset: "GMT+10",
          label: "Asia/Vladivostok",
        },
        {
          offset: "GMT+9",
          label: "Asia/Yakutsk",
        },
        {
          offset: "GMT+5",
          label: "Asia/Yekaterinburg",
        },
        {
          offset: "GMT+4",
          label: "Asia/Yerevan",
        },
        {
          offset: "GMT",
          label: "Atlantic/Azores",
        },
        {
          offset: "GMT-3",
          label: "Atlantic/Bermuda",
        },
        {
          offset: "GMT+1",
          label: "Atlantic/Canary",
        },
        {
          offset: "GMT-1",
          label: "Atlantic/Cape_Verde",
        },
        {
          offset: "GMT+1",
          label: "Atlantic/Faeroe",
        },
        {
          offset: "GMT+1",
          label: "Atlantic/Madeira",
        },
        {
          offset: "GMT",
          label: "Atlantic/Reykjavik",
        },
        {
          offset: "GMT-2",
          label: "Atlantic/South_Georgia",
        },
        {
          offset: "GMT",
          label: "Atlantic/St_Helena",
        },
        {
          offset: "GMT-3",
          label: "Atlantic/Stanley",
        },
        {
          offset: "GMT+10:30",
          label: "Australia/Adelaide",
        },
        {
          offset: "GMT+10",
          label: "Australia/Brisbane",
        },
        {
          offset: "GMT+10:30",
          label: "Australia/Broken_Hill",
        },
        {
          offset: "GMT+9:30",
          label: "Australia/Darwin",
        },
        {
          offset: "GMT+8:45",
          label: "Australia/Eucla",
        },
        {
          offset: "GMT+11",
          label: "Australia/Hobart",
        },
        {
          offset: "GMT+10",
          label: "Australia/Lindeman",
        },
        {
          offset: "GMT+11",
          label: "Australia/Lord_Howe",
        },
        {
          offset: "GMT+11",
          label: "Australia/Melbourne",
        },
        {
          offset: "GMT+8",
          label: "Australia/Perth",
        },
        {
          offset: "GMT+11",
          label: "Australia/Sydney",
        },
        {
          offset: "GMT+2",
          label: "Europe/Amsterdam",
        },
        {
          offset: "GMT+2",
          label: "Europe/Andorra",
        },
        {
          offset: "GMT+4",
          label: "Europe/Astrakhan",
        },
        {
          offset: "GMT+3",
          label: "Europe/Athens",
        },
        {
          offset: "GMT+2",
          label: "Europe/Belgrade",
        },
        {
          offset: "GMT+2",
          label: "Europe/Berlin",
        },
        {
          offset: "GMT+2",
          label: "Europe/Bratislava",
        },
        {
          offset: "GMT+2",
          label: "Europe/Brussels",
        },
        {
          offset: "GMT+3",
          label: "Europe/Bucharest",
        },
        {
          offset: "GMT+2",
          label: "Europe/Budapest",
        },
        {
          offset: "GMT+2",
          label: "Europe/Busingen",
        },
        {
          offset: "GMT+3",
          label: "Europe/Chisinau",
        },
        {
          offset: "GMT+2",
          label: "Europe/Copenhagen",
        },
        {
          offset: "GMT+1",
          label: "Europe/Dublin",
        },
        {
          offset: "GMT+2",
          label: "Europe/Gibraltar",
        },
        {
          offset: "GMT+1",
          label: "Europe/Guernsey",
        },
        {
          offset: "GMT+3",
          label: "Europe/Helsinki",
        },
        {
          offset: "GMT+1",
          label: "Europe/Isle_of_Man",
        },
        {
          offset: "GMT+3",
          label: "Europe/Istanbul",
        },
        {
          offset: "GMT+1",
          label: "Europe/Jersey",
        },
        {
          offset: "GMT+2",
          label: "Europe/Kaliningrad",
        },
        {
          offset: "GMT+3",
          label: "Europe/Kiev",
        },
        {
          offset: "GMT+3",
          label: "Europe/Kirov",
        },
        {
          offset: "GMT+1",
          label: "Europe/Lisbon",
        },
        {
          offset: "GMT+2",
          label: "Europe/Ljubljana",
        },
        {
          offset: "GMT+1",
          label: "Europe/London",
        },
        {
          offset: "GMT+2",
          label: "Europe/Luxembourg",
        },
        {
          offset: "GMT+2",
          label: "Europe/Madrid",
        },
        {
          offset: "GMT+2",
          label: "Europe/Malta",
        },
        {
          offset: "GMT+3",
          label: "Europe/Mariehamn",
        },
        {
          offset: "GMT+3",
          label: "Europe/Minsk",
        },
        {
          offset: "GMT+2",
          label: "Europe/Monaco",
        },
        {
          offset: "GMT+3",
          label: "Europe/Moscow",
        },
        {
          offset: "GMT+2",
          label: "Europe/Oslo",
        },
        {
          offset: "GMT+2",
          label: "Europe/Paris",
        },
        {
          offset: "GMT+2",
          label: "Europe/Podgorica",
        },
        {
          offset: "GMT+2",
          label: "Europe/Prague",
        },
        {
          offset: "GMT+3",
          label: "Europe/Riga",
        },
        {
          offset: "GMT+2",
          label: "Europe/Rome",
        },
        {
          offset: "GMT+4",
          label: "Europe/Samara",
        },
        {
          offset: "GMT+2",
          label: "Europe/San_Marino",
        },
        {
          offset: "GMT+2",
          label: "Europe/Sarajevo",
        },
        {
          offset: "GMT+4",
          label: "Europe/Saratov",
        },
        {
          offset: "GMT+3",
          label: "Europe/Simferopol",
        },
        {
          offset: "GMT+2",
          label: "Europe/Skopje",
        },
        {
          offset: "GMT+3",
          label: "Europe/Sofia",
        },
        {
          offset: "GMT+2",
          label: "Europe/Stockholm",
        },
        {
          offset: "GMT+3",
          label: "Europe/Tallinn",
        },
        {
          offset: "GMT+2",
          label: "Europe/Tirane",
        },
        {
          offset: "GMT+4",
          label: "Europe/Ulyanovsk",
        },
        {
          offset: "GMT+2",
          label: "Europe/Vaduz",
        },
        {
          offset: "GMT+2",
          label: "Europe/Vatican",
        },
        {
          offset: "GMT+2",
          label: "Europe/Vienna",
        },
        {
          offset: "GMT+3",
          label: "Europe/Vilnius",
        },
        {
          offset: "GMT+3",
          label: "Europe/Volgograd",
        },
        {
          offset: "GMT+2",
          label: "Europe/Warsaw",
        },
        {
          offset: "GMT+2",
          label: "Europe/Zagreb",
        },
        {
          offset: "GMT+2",
          label: "Europe/Zurich",
        },
        {
          offset: "GMT+3",
          label: "Indian/Antananarivo",
        },
        {
          offset: "GMT+6",
          label: "Indian/Chagos",
        },
        {
          offset: "GMT+7",
          label: "Indian/Christmas",
        },
        {
          offset: "GMT+6:30",
          label: "Indian/Cocos",
        },
        {
          offset: "GMT+3",
          label: "Indian/Comoro",
        },
        {
          offset: "GMT+5",
          label: "Indian/Kerguelen",
        },
        {
          offset: "GMT+4",
          label: "Indian/Mahe",
        },
        {
          offset: "GMT+5",
          label: "Indian/Maldives",
        },
        {
          offset: "GMT+4",
          label: "Indian/Mauritius",
        },
        {
          offset: "GMT+3",
          label: "Indian/Mayotte",
        },
        {
          offset: "GMT+4",
          label: "Indian/Reunion",
        },
        {
          offset: "GMT+13",
          label: "Pacific/Apia",
        },
        {
          offset: "GMT+13",
          label: "Pacific/Auckland",
        },
        {
          offset: "GMT+11",
          label: "Pacific/Bougainville",
        },
        {
          offset: "GMT+13:45",
          label: "Pacific/Chatham",
        },
        {
          offset: "GMT-5",
          label: "Pacific/Easter",
        },
        {
          offset: "GMT+11",
          label: "Pacific/Efate",
        },
        {
          offset: "GMT+13",
          label: "Pacific/Enderbury",
        },
        {
          offset: "GMT+13",
          label: "Pacific/Fakaofo",
        },
        {
          offset: "GMT+12",
          label: "Pacific/Fiji",
        },
        {
          offset: "GMT+12",
          label: "Pacific/Funafuti",
        },
        {
          offset: "GMT-6",
          label: "Pacific/Galapagos",
        },
        {
          offset: "GMT-9",
          label: "Pacific/Gambier",
        },
        {
          offset: "GMT+11",
          label: "Pacific/Guadalcanal",
        },
        {
          offset: "GMT+10",
          label: "Pacific/Guam",
        },
        {
          offset: "GMT-10",
          label: "Pacific/Honolulu",
        },
        {
          offset: "GMT+14",
          label: "Pacific/Kiritimati",
        },
        {
          offset: "GMT+11",
          label: "Pacific/Kosrae",
        },
        {
          offset: "GMT+12",
          label: "Pacific/Kwajalein",
        },
        {
          offset: "GMT+12",
          label: "Pacific/Majuro",
        },
        {
          offset: "GMT-9:30",
          label: "Pacific/Marquesas",
        },
        {
          offset: "GMT-11",
          label: "Pacific/Midway",
        },
        {
          offset: "GMT+12",
          label: "Pacific/Nauru",
        },
        {
          offset: "GMT-11",
          label: "Pacific/Niue",
        },
        {
          offset: "GMT+12",
          label: "Pacific/Norfolk",
        },
        {
          offset: "GMT+11",
          label: "Pacific/Noumea",
        },
        {
          offset: "GMT-11",
          label: "Pacific/Pago_Pago",
        },
        {
          offset: "GMT+9",
          label: "Pacific/Palau",
        },
        {
          offset: "GMT-8",
          label: "Pacific/Pitcairn",
        },
        {
          offset: "GMT+11",
          label: "Pacific/Ponape",
        },
        {
          offset: "GMT+10",
          label: "Pacific/Port_Moresby",
        },
        {
          offset: "GMT-10",
          label: "Pacific/Rarotonga",
        },
        {
          offset: "GMT+10",
          label: "Pacific/Saipan",
        },
        {
          offset: "GMT-10",
          label: "Pacific/Tahiti",
        },
        {
          offset: "GMT+12",
          label: "Pacific/Tarawa",
        },
        {
          offset: "GMT+13",
          label: "Pacific/Tongatapu",
        },
        {
          offset: "GMT+10",
          label: "Pacific/Truk",
        },
        {
          offset: "GMT+12",
          label: "Pacific/Wake",
        },
        {
          offset: "GMT+12",
          label: "Pacific/Wallis",
        },
      ].sort((a, b) => this.compareOffsets(a.offset, b.offset));
    }

    this.tz.unshift({ offset: "", label: "System Timezone -" });
    this.dateTimezone().setValidators([Validators.required, requireMatch(this.tz)]);

    // add autocomplete filtering
    this.filteredTZ = this.dateTimezone().valueChanges.pipe(
      debounceTime(500),
      startWith(''),
      map(value => this.filterTZ(value || ''))
    );

    this.filteredTZSubscription = this.filteredTZ.pipe(takeUntilDestroyed(this._destroyRef)).subscribe();
  }

  private filterTZ( value: string ): ITzDefinition[] {
    const filterValue = value.toLowerCase();
    return this.tz.filter(val => val.label.toLowerCase().includes(filterValue));
  }

  private compareOffsets(offsetA: string, offsetB: string): number {
    const parseOffset = (offset: string): number => {
      const match = offset.match(/([+-]?)(\d+)(?::(\d+))?/); // Match offsets like "+5:30", "-3", etc.
      if (!match) return 0;

      const sign = match[1] === '-' ? -1 : 1;
      const hours = parseInt(match[2], 10);
      const minutes = match[3] ? parseInt(match[3], 10) : 0;

      return sign * (hours * 60 + minutes); // Convert to total minutes
    };

    return parseOffset(offsetA) - parseOffset(offsetB);
  }
}
