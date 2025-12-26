# Register your models here.

from django.contrib import admin
from .models import BingoBoard, RaffleState, TwoFieldTab

@admin.register(BingoBoard)
class BingoBoardAdmin(admin.ModelAdmin):
    list_display = ("user", "email", "updated_at")
    search_fields = ("user__username", "email")

# admin.py
from django.contrib import messages
from django.db import IntegrityError, transaction



@admin.register(TwoFieldTab)
class TwoFieldTabAdmin(admin.ModelAdmin):
    list_display = ("user", "value")
    search_fields = ("user__username",)
    autocomplete_fields = ("user",)

    def save_model(self, request, obj, form, change):
        # change=False -> Add, change=True -> Edit
        try:
            with transaction.atomic():
                super().save_model(request, obj, form, change)
        except IntegrityError:
            # jeśli user już ma rekord (OneToOne unique)
            self.message_user(
                request,
                "Ten użytkownik ma już rekord. Wejdź w istniejący wpis i go edytuj (Change), zamiast dodawać nowy.",
                level=messages.ERROR,
            )
            # nie rzucamy wyjątku dalej => brak 500





# # @admin.register(RaffleState)
# # class RaffleStateAdmin(admin.ModelAdmin):
# #     list_display = ("user", "rerolls_left", "shuffles_left", "updated_at")
# #     search_fields = ("user__username",)


# @admin.register(RaffleState)
# class RaffleStateAdmin(admin.ModelAdmin):
#     list_display = ("user", "rerolls_left", "shuffles_left", "updated_at")
#     search_fields = ("user__username",)

#     def has_add_permission(self, request):
#         return False
