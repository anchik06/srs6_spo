from django.db import models


class Category(models.Model):
    name = models.CharField('Название', max_length=80, unique=True)

    class Meta:
        verbose_name = 'категория'
        verbose_name_plural = 'категории'

    def __str__(self):
        return self.name


class Project(models.Model):
    STATUS_CHOICES = [
        ('sleeping', 'На паузе'),
        ('active', 'Возвращаюсь'),
        ('finished', 'Завершён'),
    ]

    title = models.CharField('Название', max_length=120)
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT,
        related_name='projects', verbose_name='Категория',
    )
    description = models.TextField('Описание', max_length=1000)
    stop_reason = models.CharField('Почему остановился', max_length=250)
    next_step = models.CharField('Следующий маленький шаг', max_length=250)
    status = models.CharField(
        'Статус', max_length=10, choices=STATUS_CHOICES, default='sleeping',
    )
    favorite = models.BooleanField('Избранное', default=False)
    created_at = models.DateTimeField('Дата добавления', auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        verbose_name = 'проект'
        verbose_name_plural = 'проекты'

    def __str__(self):
        return self.title
