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
        sfx={}
    )

def Drymastero103_func() -> UserPluginConfig:
    return UserPluginConfig(
        js_plugin="bingo/js/plugins/Drymastero103.js",
        sfx={} # jak robisz dla piotrka to tutaj dodajesz dźwięki, ogółem images dodawaj przez js-a a nie w html-u bo nam sie zaśmieci game
    )



USER_PLUGIN_REGISTRY = {
    "oniksu": oniksu_func,
    "wanilka": wanilka_func,
    "Drymastero103": Drymastero103_func,
    #
}

def get_user_plugin(username: str) -> Optional[UserPluginConfig]:
    func = USER_PLUGIN_REGISTRY.get(username)
    if not func:
        return None
    return func()
