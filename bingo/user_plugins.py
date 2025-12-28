# bingo/user_plugins.py - tu są user specific funkcje, żeby nie rozwalać struktury views, i 
                        # żeby to gdzieś trzyamć w jednym miejscu, inaczej byłoby po prostu wrzucone 200 linijek nagle z 50 if-ami

from django.templatetags.static import static
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class UserPluginConfig:
    js_plugin: Optional[str]
    sfx: Dict[str, List[str]]

#
def oniksu_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/oniksu.js",
        sfx={
            "hide": [
                static("bingo/sfx/oniksu/twitch_on_hide_1.mp3"),
                static("bingo/sfx/oniksu/twitch_on_hide_2.mp3"),
                static("bingo/sfx/oniksu/twitch_on_hide_3.mp3"),
                static("bingo/sfx/oniksu/twitch_on_hide_4.mp3"),
            ],
            "reveal": [
                static("bingo/sfx/oniksu/twitch_on_reveal_1.mp3"),
                static("bingo/sfx/oniksu/twitch_on_reveal_2.mp3"),
                static("bingo/sfx/oniksu/twitch_on_reveal_3.mp3"),
                static("bingo/sfx/oniksu/twitch_on_reveal_4.mp3"),
                static("bingo/sfx/oniksu/twitch_on_reveal_5.mp3"),
            ],
        }
    )

def wanilka_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/wanilka.js",
        sfx={
            "pokerface": [ 
                static("bingo/sfx/wanilka/pokerface.mp3")
            ],
            "coconut_mall": [
                static("bingo/sfx/wanilka/coconut_mall.mp3")
            ]
        }
    )

def Drymastero103_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/Drymastero103.js",
        sfx={
            "gag": [
                static("bingo/sfx/Drymastero103/gag.mp3")
            ],
            "tung": [
                static("bingo/sfx/Drymastero103/tung.mp3")
            ],
        }
    )

def kyspro_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/kyspro.js",
        sfx={
            "mommy_asmr": [
                static("bingo/sfx/kyspro/mommy_asmr.mp3")
            ]
        }
    )

def jull_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/jull.js",
        sfx={}
    )

def stugsiana_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/stugsiana.js",
        sfx={
            "mango67": [
                static("bingo/sfx/stugsiana/mango67.mp3")
            ],
            "meow": [
                static("bingo/sfx/stugsiana/meow.mp3")
            ],
            "owoc": [
                static("bingo/sfx/stugsiana/owoc.mp3")
            ],
        }
    )

def nataliagl131_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/nataliagl131.js",
        sfx={}
    )

def Pesos_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/Pesos.js",
        sfx={}
    )

def SabrinaSitOnMe_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/SabrinaSitOnMe.js",
        sfx={
            "sabrina": [
                static("bingo/sfx/SabrinaSitOnMe/sabrina.mp3"),
            ],
            "hs": [
                static("bingo/sfx/SabrinaSitOnMe/hs.mp3"),
            ],
        }
    )

def kamiqxx_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/kamiqxx.js",
        sfx={"ambient": [
                static("bingo/sfx/kamiqxx/conangray.mp3"),
                static("bingo/sfx/kamiqxx/cyberp.mp3"),
                static("bingo/sfx/kamiqxx/hozier.mp3"),
                static("bingo/sfx/kamiqxx/kissingsomeoneelse.mp3"),
                static("bingo/sfx/kamiqxx/lost.mp3"),
                static("bingo/sfx/kamiqxx/outoftouch.mp3"),
                static("bingo/sfx/kamiqxx/robbers.mp3"),
                static("bingo/sfx/kamiqxx/sitnexttome.mp3"),
                static("bingo/sfx/kamiqxx/stargazing.mp3"),
                static("bingo/sfx/kamiqxx/stevienicks.mp3"),
            ]
        }
    )

def BigMan_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/BigMan.js",
        sfx={}
    )


USER_PLUGIN_REGISTRY = {
                                                #0    
    "oniksu": oniksu_func,                      # 1                        
    "wanilka": wanilka_func,                    #  2   
    "Drymastero103": Drymastero103_func,        #   3                   
    "kyspro":kyspro_func,                       #    4  
    "jull":jull_func,                           #     5   
    "stugsiana":stugsiana_func,                 #      6    
    "nataliagl131":nataliagl131_func,           #       7           
    "Pesos":Pesos_func,                         #        8   
    "SabrinaSitOnMe":SabrinaSitOnMe_func,       #         9            
    "kamiqxx":kamiqxx_func,                     #         10
    "BigMan": BigMan_func,                      #__________11

}

def get_user_plugin(username: str) -> Optional[UserPluginConfig]:
    func = USER_PLUGIN_REGISTRY.get(username)
    if not func:
        return None
    return func()
