# Register your models here.

from django.contrib import admin
from .models import BingoBoard, RaffleState

@admin.register(BingoBoard)
class BingoBoardAdmin(admin.ModelAdmin):
    list_display = ("user", "email", "updated_at")
    search_fields = ("user__username", "email")

@admin.register(RaffleState)
class RaffleStateAdmin(admin.ModelAdmin):
    list_display = ("user", "rerolls_left", "shuffles_left", "updated_at")
    search_fields = ("user__username",)